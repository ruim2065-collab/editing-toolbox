import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createWorker } from "tesseract.js";

const root = process.cwd();
const indexPath = path.join(root, "api", "data", "font-screenshot-index.json");
const csvPath = path.join(root, "knowledge", "font-library", "font-screenshot-index.csv");
const limitArg = Number(process.argv.find(arg => arg.startsWith("--limit="))?.split("=")[1] || 0);
const startArg = Number(process.argv.find(arg => arg.startsWith("--start="))?.split("=")[1] || 0);
const force = process.argv.includes("--force");
const onlyUncertain = process.argv.includes("--only-uncertain");
const tmpDir = path.join(root, "tmp", "font-label-local-ocr");
const cropDir = path.join(tmpDir, "crops");

const index = JSON.parse(fs.readFileSync(indexPath, "utf8").replace(/^\uFEFF/, ""));
const items = index.items || [];
let processed = 0;
let changed = 0;

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeOutputs() {
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
  const fields = index.fields || Object.keys(items[0] || {});
  const csv = [
    fields.map(csvEscape).join(","),
    ...items.map(item => fields.map(field => csvEscape(item[field])).join(","))
  ].join("\n");
  fs.writeFileSync(csvPath, csv, "utf8");
}

function psQuote(value) {
  return String(value).replace(/'/g, "''");
}

function cleanFontName(value) {
  let text = String(value || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)[0] || "";

  text = text
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}\u4e00-\u9fff]+/u, "")
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff ._+\-'"&]+$/u, "")
    .trim();

  let parts = text.split(" ").filter(Boolean);
  if (parts.length > 1 && /^[A-Za-z0-9]$/.test(parts[0])) parts = parts.slice(1);
  if (parts.length > 1 && /^[A-Za-z]{1,3}$/.test(parts[parts.length - 1])) parts = parts.slice(0, -1);
  text = parts.join(" ").trim();

  if (!text || /^不确定$|^未识别|^无法$/i.test(text)) return "";
  return text.slice(0, 80);
}

function hasCjk(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function isLikelyNoise(value, oldName) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (/^[A-Z]{2,5}$/.test(text) && (!oldName || hasCjk(oldName))) return true;
  if (/^[A-Z]{2,8}$/.test(text) && hasCjk(oldName)) return true;
  return false;
}

function normalizeCandidate(value) {
  return hasCjk(value) ? String(value).replace(/\s+/g, "") : String(value || "").trim();
}

function cropLabel(item) {
  fs.mkdirSync(cropDir, { recursive: true });
  const cropPath = path.join(cropDir, `${item.id}.png`);
  const source = item.originalPath;
  const script = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$src='${psQuote(source)}'
$dst='${psQuote(cropPath)}'
$img=[System.Drawing.Image]::FromFile($src)
try {
  $w=$img.Width
  $h=$img.Height
  $x=[int]($w*0.10)
  $y=[int]($h*0.30)
  $cw=[int]($w*0.80)
  $ch=[int]($h*0.16)
  $scale=5
  $bmp=New-Object System.Drawing.Bitmap ($cw*$scale),($ch*$scale)
  $g=[System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Black)
    $dest=New-Object System.Drawing.Rectangle 0,0,($cw*$scale),($ch*$scale)
    $srcRect=New-Object System.Drawing.Rectangle $x,$y,$cw,$ch
    $g.DrawImage($img,$dest,$srcRect,[System.Drawing.GraphicsUnit]::Pixel)
  } finally {
    $g.Dispose()
  }
  $bmp.Save($dst,[System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
} finally {
  $img.Dispose()
}
`;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  return cropPath;
}

fs.mkdirSync(path.join(tmpDir, "traineddata"), { recursive: true });
const worker = await createWorker("eng+chi_sim", 1, {
  cachePath: path.join(tmpDir, "traineddata")
});

try {
  for (let i = startArg; i < items.length; i++) {
    const item = items[i];
    if (limitArg && processed >= limitArg) break;
    if (!item) continue;
    if (onlyUncertain && item.visibleFontName && !/uncertain|error|pending/i.test(String(item.ocrStatus || ""))) continue;
    if (!force && item.visibleFontName && !onlyUncertain) continue;
    if (!fs.existsSync(item.originalPath)) {
      item.ocrStatus = "missing_source";
      continue;
    }

    processed += 1;
    try {
      const cropPath = cropLabel(item);
      const { data } = await worker.recognize(cropPath);
      const rawName = cleanFontName(data.text);
      const name = normalizeCandidate(rawName);
      const oldName = item.visibleFontName || "";
      if (name && !isLikelyNoise(name, oldName)) {
        item.visibleFontName = name;
        item.ocrStatus = "local_label_ocr_done";
        item.usageNotes = item.usageNotes || "字体名来自本地OCR读取截图上方小字标签。";
        if (oldName !== name) changed += 1;
      } else {
        item.ocrStatus = "local_label_ocr_uncertain";
      }
      console.log(`[${i + 1}/${items.length}] ${item.id} ${item.source} ${oldName || "(空)"} => ${name || "不确定"}`);
    } catch (err) {
      item.ocrStatus = "local_label_ocr_error";
      item.usageNotes = `Local label OCR error: ${String(err.message || err).slice(0, 160)}`;
      console.log(`[${i + 1}/${items.length}] ${item.id} ERROR ${err.message || err}`);
    }

    if (processed % 20 === 0) writeOutputs();
  }
} finally {
  await worker.terminate();
}

writeOutputs();
console.log(`processed=${processed} changed=${changed}`);
