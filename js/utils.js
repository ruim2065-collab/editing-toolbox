/* ============================================================
   剪辑接单百宝箱 — 工具函数
   ============================================================ */

// ---- DOM helpers ----
export function el(selector, root = document) {
  return root.querySelector(selector);
}

export function all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

// ---- Toast ----
let toastTimer;
export function showToast(message) {
  const toast = el("#toast");
  el("span", toast).textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---- Choice helper ----
export function choice(name, values, checked = 0) {
  return `<div class="choice-row">${values.map((value, i) => `
    <label class="choice"><input type="radio" name="${name}" value="${value}" ${i === checked ? "checked" : ""}><span>${value}</span></label>`).join("")}</div>`;
}

// ---- Result shells ----
export function resultShell(id, label) {
  return `
    <div class="result-panel surface">
      <div class="panel-title"><h3>生成结果</h3><span>模拟结果</span></div>
      <div id="${id}">
        <div class="empty-result">
          <div><div class="empty-icon">结果</div><strong>等待生成</strong><p>填写左侧信息并点击「${label}」，这里会显示结构化模拟结果。</p></div>
        </div>
      </div>
    </div>`;
}

export function resultCard(title, body, full = false) {
  const content = Array.isArray(body)
    ? `<ul>${body.map(item => `<li>${item}</li>`).join("")}</ul>`
    : `<p>${body}</p>`;
  return `<div class="result-card ${full ? "full" : ""}"><h5>${title}</h5>${content}</div>`;
}

export function resultLayout(heroLabel, hero, cards) {
  return `<div class="result-content">
    <div class="result-hero"><small>${heroLabel}</small><h4>${hero}</h4></div>
    <div class="result-grid">${cards.join("")}</div>
    <div class="result-toolbar">
      <button class="secondary-button copy-result" type="button">复制结果</button>
      <button class="export-button export-pdf" type="button">导出 PDF</button>
    </div>
  </div>`;
}

// ---- Simulate (with optional AI) ----
export function simulate(form, button, callback, useAI = false) {
  button.classList.add("button-loading");
  const original = button.textContent;
  button.textContent = useAI ? "AI 思考中" : "正在生成";
  const delay = useAI ? 1500 : 650;

  if (useAI && window._aiGenerate) {
    // Use real AI API
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    window._aiGenerate(data, callback, button, original);
  } else {
    setTimeout(() => {
      button.classList.remove("button-loading");
      button.textContent = original;
      callback(new FormData(form));
      showToast("结果已生成，可以继续修改信息重新测试。");
    }, delay);
  }
}

// ---- File helpers ----
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ---- PDF Export ----
export function exportToPdf(element) {
  const content = element.closest(".result-content");
  if (!content) return showToast("没有可导出的结果。");

  const toolName = el("#pageTitle").textContent || "百宝箱";
  const win = window.open("", "_blank", "width=800,height=600");
  const styles = document.querySelector('link[rel="stylesheet"]')?.href || '';
  win.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${toolName} - 导出结果</title>
<link rel="stylesheet" href="${styles}">
<style>
  body { padding: 30px; background: #aaa9a5; font-family: "Microsoft YaHei UI", "PingFang SC", sans-serif; }
  .result-content { max-width: 700px; margin: 0 auto; }
  @media print { body { background: #fff; padding: 0; } .result-toolbar { display: none; } }
</style></head>
<body><div class="result-content">${content.innerHTML}</div></body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ---- localStorage History ----
const HISTORY_KEY = "toolbox_history";
const MAX_HISTORY = 50;

export function saveToHistory(toolId, toolName, preview) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    history.unshift({
      toolId,
      toolName,
      preview: preview.substring(0, 120),
      full: preview,
      time: Date.now()
    });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { /* quota exceeded, ignore */ }
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (e) { return []; }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

// ---- Stats (for home dashboard) ----
const STATS_KEY = "toolbox_stats";

export function recordToolUsage(toolId) {
  try {
    const stats = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    stats[toolId] = (stats[toolId] || 0) + 1;
    stats._total = (stats._total || 0) + 1;
    stats._lastUsed = Date.now();
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    return stats;
  } catch (e) { return {}; }
}

export function getStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
  } catch (e) { return {}; }
}

// ---- Theme ----
export function initTheme() {
  const saved = localStorage.getItem("toolbox_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  return saved;
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("toolbox_theme", next);
  return next;
}
