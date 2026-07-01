import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const indexPath = path.join(root, "api", "data", "font-screenshot-index.json");
const csvPath = path.join(root, "knowledge", "font-library", "font-screenshot-index.csv");
const endpoint = process.env.FONT_VISION_ENDPOINT || "https://editing-toolbox-6i5o.vercel.app/api/vision";
const limitArg = Number(process.argv.find(arg => arg.startsWith("--limit="))?.split("=")[1] || 0);
const startArg = Number(process.argv.find(arg => arg.startsWith("--start="))?.split("=")[1] || 0);
const delayMs = Number(process.argv.find(arg => arg.startsWith("--delay="))?.split("=")[1] || 600);
const onlyUncertain = process.argv.includes("--only-uncertain");
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");
const tmpDir = path.join(root, "tmp", "font-label-ocr");
const cropDir = path.join(tmpDir, "crops");
const bodyDir = path.join(tmpDir, "bodies");

const index = JSON.parse(fs.readFileSync(indexPath, "utf8").replace(/^\uFEFF/, ""));
const items = index.items || [];
let processed = 0;
let changed = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanFontName(value) {
  const text = String(value || "").trim();
  if (!text || /^不确定$|^未识别|^无法$/.test(text)) return "";
  return text.replace(/\s+/g, " ").replace(/[，。；;:：]+$/g, "").slice(0, 80);
}

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
  if ($cw -lt 1) { $cw = $w }
  if ($ch -lt 1) { $ch = [Math]::Max(1, [int]($h*0.25)) }
  $scale=4
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

function recognizeLabel(item, cropPath) {
  fs.mkdirSync(bodyDir, { recursive: true });
  const bytes = fs.readFileSync(cropPath);
  const body = {
    mode: "font",
    image: {
      dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
      mime: "image/png",
      name: `${item.id}-label.png`,
      size: bytes.length,
      labelOnly: true
    }
  };
  const bodyPath = path.join(bodyDir, `${item.id}.json`);
  fs.writeFileSync(bodyPath, JSON.stringify(body), "utf8");
  const script = [
    "$ErrorActionPreference='Stop'",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
    "$OutputEncoding = [Console]::OutputEncoding",
    `$r = Invoke-RestMethod -Uri '${psQuote(endpoint)}' -Method Post -ContentType 'application/json' -InFile '${psQuote(bodyPath)}' -TimeoutSec 120`,
    "$r | ConvertTo-Json -Depth 30 -Compress"
  ].join("; ");
  const output = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  fs.rmSync(bodyPath, { force: true });
  const data = JSON.parse(output);
  if (!data.ok) throw new Error(data.message || data.error || "label OCR failed");
  return data.analysis || {};
}

for (let i = startArg; i < items.length; i++) {
  const item = items[i];
  if (limitArg && processed >= limitArg) break;
  if (!item) continue;
  if (onlyUncertain && item.ocrStatus !== "vision_uncertain") continue;
  if (!force && item.visibleFontName && item.ocrStatus !== "vision_uncertain") continue;
  if (!fs.existsSync(item.originalPath)) {
    item.ocrStatus = "missing_source";
    continue;
  }

  processed += 1;
  try {
    const cropPath = cropLabel(item);
    const analysis = recognizeLabel(item, cropPath);
    const name = cleanFontName(analysis.visibleFontName);
    const oldName = item.visibleFontName || "";
    if (name && !dryRun) {
      item.visibleFontName = name;
      item.ocrStatus = "label_ocr_done";
      item.usageNotes = item.usageNotes || "字体名来自截图上方小字标签OCR。";
      changed += oldName !== name ? 1 : 0;
    } else if (!name && !dryRun) {
      item.ocrStatus = "label_ocr_uncertain";
    }
    console.log(`[${i + 1}/${items.length}] ${item.id} ${item.source} ${oldName || "(空)"} => ${name || "不确定"}`);
  } catch (err) {
    if (!dryRun) item.ocrStatus = "label_ocr_error";
    item.usageNotes = `Label OCR error: ${String(err.message || err).slice(0, 160)}`;
    console.log(`[${i + 1}/${items.length}] ${item.id} ERROR ${err.message || err}`);
  }

  if (!dryRun && processed % 5 === 0) writeOutputs();
  if (delayMs > 0) await sleep(delayMs);
}

if (!dryRun) writeOutputs();
console.log(`processed=${processed} changed=${changed}`);
