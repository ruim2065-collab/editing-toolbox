import fs from "node:fs";
import path from "node:path";

const index = JSON.parse(fs.readFileSync("api/data/font-screenshot-index.json", "utf8"));
const uncertain = (index.items || []).filter(item => item.ocrStatus === "vision_uncertain");
const outDir = path.join("knowledge", "font-library");
const fields = ["id", "source", "fileName", "relativePath", "originalPath", "width", "height", "ocrStatus"];

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csv = [
  fields.join(","),
  ...uncertain.map(item => fields.map(field => csvEscape(item[field])).join(","))
].join("\n");
fs.writeFileSync(path.join(outDir, "font-screenshot-uncertain.csv"), csv, "utf8");

const md = [
  "# 字体名未确认清单",
  "",
  `共 ${uncertain.length} 个。`,
  "",
  "| 编号 | 来源 | 文件名 | 原始路径 |",
  "|---|---|---|---|",
  ...uncertain.map(item => `| ${item.id} | ${item.source} | ${item.fileName} | ${item.originalPath} |`)
].join("\n");
fs.writeFileSync(path.join(outDir, "font-screenshot-uncertain.md"), md, "utf8");

console.log(`count=${uncertain.length}`);
console.log(uncertain.map(item => `${item.id}\t${item.source}\t${item.fileName}`).join("\n"));
