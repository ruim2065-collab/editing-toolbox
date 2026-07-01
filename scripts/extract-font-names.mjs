import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const indexPath = path.join(root, "api", "data", "font-screenshot-index.json");
const csvPath = path.join(root, "knowledge", "font-library", "font-screenshot-index.csv");
const endpoint = process.env.FONT_VISION_ENDPOINT || "https://editing-toolbox-6i5o.vercel.app/api/vision";
const limitArg = Number(process.argv.find(arg => arg.startsWith("--limit="))?.split("=")[1] || 0);
const startArg = Number(process.argv.find(arg => arg.startsWith("--start="))?.split("=")[1] || 0);
const delayMs = Number(process.argv.find(arg => arg.startsWith("--delay="))?.split("=")[1] || 800);
const transport = process.argv.find(arg => arg.startsWith("--transport="))?.split("=")[1] || "fetch";
const retryUncertain = process.argv.includes("--retry-uncertain");
const retryErrors = process.argv.includes("--retry-errors");
const tmpDir = path.join(root, "tmp", "font-ocr-bodies");

const index = JSON.parse(fs.readFileSync(indexPath, "utf8").replace(/^\uFEFF/, ""));
const items = index.items || [];
let processed = 0;
let changed = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function imageToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  const base64 = fs.readFileSync(filePath).toString("base64");
  return { dataUrl: `data:${mime};base64,${base64}`, mime };
}

function cleanFontName(value) {
  const text = String(value || "").trim();
  if (!text || /^不确定$|^未识别|^无法/.test(text)) return "";
  return text.replace(/\s+/g, " ").slice(0, 80);
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

async function recognize(item) {
  const { dataUrl, mime } = imageToDataUrl(item.originalPath);
  const body = {
    mode: "font",
    image: {
      dataUrl,
      mime,
      name: item.fileName,
      size: item.bytes
    }
  };
  if (transport === "powershell") {
    fs.mkdirSync(tmpDir, { recursive: true });
    const bodyPath = path.join(tmpDir, `${item.id}.json`);
    fs.writeFileSync(bodyPath, JSON.stringify(body), "utf8");
    const script = [
      "$ErrorActionPreference='Stop'",
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
      "$OutputEncoding = [Console]::OutputEncoding",
      `$r = Invoke-RestMethod -Uri '${endpoint}' -Method Post -ContentType 'application/json' -InFile '${bodyPath.replace(/'/g, "''")}' -TimeoutSec 120`,
      "$r | ConvertTo-Json -Depth 30 -Compress"
    ].join("; ");
    const output = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    });
    fs.rmSync(bodyPath, { force: true });
    const data = JSON.parse(output);
    if (!data.ok) throw new Error(data.message || data.error || "PowerShell request failed");
    return data.analysis || {};
  } else {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return data.analysis || {};
  }
}

for (let i = startArg; i < items.length; i++) {
  const item = items[i];
  if (limitArg && processed >= limitArg) break;
  if (!item || item.visibleFontName) continue;
  if (!retryUncertain && item.ocrStatus === "vision_uncertain") continue;
  if (!retryErrors && item.ocrStatus === "vision_error") continue;
  if (!["pending", "vision_uncertain", "vision_error", "", undefined].includes(item.ocrStatus)) continue;
  if (!fs.existsSync(item.originalPath)) {
    item.ocrStatus = "missing_source";
    continue;
  }

  processed += 1;
  try {
    const analysis = await recognize(item);
    const name = cleanFontName(analysis.visibleFontName);
    item.visibleFontName = name;
    item.ocrStatus = name ? "vision_done" : "vision_uncertain";
    item.styleTags = item.styleTags || [analysis.fontType, analysis.weight].filter(Boolean).join(" / ");
    item.jianyingSearchKeywords = Array.isArray(analysis.jianyingSearchKeywords)
      ? analysis.jianyingSearchKeywords.map(entry => entry.keyword).filter(Boolean).join(" / ")
      : item.jianyingSearchKeywords || "";
    item.usageNotes = item.usageNotes || (Array.isArray(analysis.suitableVideos) ? analysis.suitableVideos.join(" / ") : "");
    changed += 1;
    console.log(`[${i + 1}/${items.length}] ${item.id} ${item.source} => ${item.visibleFontName || "不确定"}`);
  } catch (err) {
    if (item.ocrStatus !== "vision_uncertain") item.ocrStatus = "vision_error";
    item.usageNotes = `OCR error: ${String(err.message || err).slice(0, 160)}`;
    console.log(`[${i + 1}/${items.length}] ${item.id} ERROR ${err.message || err}`);
  }

  if (changed % 5 === 0) writeOutputs();
  if (delayMs > 0) await sleep(delayMs);
}

writeOutputs();
console.log(`processed=${processed} changed=${changed}`);
