import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createWorker } from "tesseract.js";

const root = process.cwd();
const indexPath = path.join(root, "api", "data", "font-screenshot-index.json");
const tmpDir = path.join(root, "tmp", "font-label-audit");
const cropDir = path.join(tmpDir, "crops");
const reportPath = path.join(tmpDir, "ocr-mismatch-report.json");

function psQuote(value) {
  return String(value).replace(/'/g, "''");
}

function normalize(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)[0] || "";
}

function clean(value) {
  return normalize(value)
    .replace(/[|]/g, "I")
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-z0-9\u4e00-\u9fff]+/, "")
    .replace(/[^A-Za-z0-9\u4e00-\u9fff ._+\-'"&]+$/g, "")
    .trim();
}

function key(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[._+\-'"&]/g, "");
}

function hasCjk(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function isLatinUseful(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9 ._+\-'"&]{3,80}$/.test(text) && /[A-Za-z]/.test(text);
}

function cropLabel(item) {
  fs.mkdirSync(cropDir, { recursive: true });
  const cropPath = path.join(cropDir, `${item.id}.png`);
  const script = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$src='${psQuote(item.originalPath)}'
$dst='${psQuote(cropPath)}'
$img=[System.Drawing.Image]::FromFile($src)
try {
  $w=$img.Width
  $h=$img.Height
  $x=[int]($w*0.08)
  $y=[int]($h*0.25)
  $cw=[int]($w*0.84)
  $ch=[int]($h*0.25)
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

const index = JSON.parse(fs.readFileSync(indexPath, "utf8").replace(/^\uFEFF/, ""));
fs.mkdirSync(path.join(tmpDir, "traineddata"), { recursive: true });
const worker = await createWorker("eng+chi_sim", 1, {
  cachePath: path.join(tmpDir, "traineddata")
});

const mismatches = [];
let checked = 0;

try {
  for (const item of index.items || []) {
    if (!item?.originalPath || !fs.existsSync(item.originalPath)) continue;
    checked += 1;
    const cropPath = cropLabel(item);
    const { data } = await worker.recognize(cropPath);
    const ocr = clean(data.text);
    const current = String(item.visibleFontName || "").trim();
    const latinMismatch = isLatinUseful(ocr) && isLatinUseful(current) && key(ocr) !== key(current);
    const cjkHint = hasCjk(ocr) && hasCjk(current) && key(ocr) !== key(current);
    if (latinMismatch || cjkHint || !current) {
      mismatches.push({
        id: item.id,
        source: item.source,
        current,
        localOcr: ocr,
        status: item.ocrStatus,
        originalPath: item.originalPath,
        cropPath,
        reason: latinMismatch ? "latin-mismatch" : cjkHint ? "cjk-hint" : "empty-current"
      });
    }
    if (checked % 100 === 0) console.log(`checked=${checked} mismatches=${mismatches.length}`);
  }
} finally {
  await worker.terminate();
}

fs.writeFileSync(reportPath, JSON.stringify({ checked, mismatchCount: mismatches.length, mismatches }, null, 2), "utf8");
console.log(JSON.stringify({ checked, mismatchCount: mismatches.length, reportPath }, null, 2));
