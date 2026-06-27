/* ============================================================
   剪辑接单百宝箱 — 主应用逻辑
   路由 / 导航 / 初始化
   ============================================================ */

import { el, all, showToast, formatBytes, initTheme, toggleTheme, getHistory, clearHistory, recordToolUsage, getStats, saveToHistory, exportToPdf } from "./utils.js";

// ---- Tool Registry ----
export const tools = [
  { id: "home", name: "首页", short: "首", title: "首页", desc: "查看工具概览与使用入口", subtitle: "剪辑课学员专属增值工具箱 · 支持 AI 智能生成与离线使用", tags: ["概览","入口"] },
  { id: "quote", name: "接单工具", short: "价", title: "接单报价助手", desc: "快速生成报价参考、交付清单和确认问题", subtitle: "根据客户类型、视频需求和交付条件生成报价参考", tags: ["报价","接单","客户"] },
  { id: "talk", name: "沟通话术", short: "聊", title: "客户沟通话术助手", desc: "面对压价、催稿和加需求时更从容", subtitle: "把客户原话整理成温和、专业与强边界三种回复", tags: ["沟通","客户","话术"] },
  { id: "revision", name: "修改整理", short: "改", title: "修改意见整理助手", desc: "把零散反馈变成可执行修改清单", subtitle: "整理时间点、修改类型、优先级与二次确认事项", tags: ["修改","整理"] },
  { id: "portfolio", name: "作品集工具", short: "集", title: "作品集包装助手", desc: "把剪过的视频包装成能接单的案例", subtitle: "生成作品集标题、案例介绍与多平台发布文案", tags: ["作品集","包装","展示"] },
  { id: "material", name: "素材工具", short: "材", title: "素材辅助工具", desc: "字体参考与图片视频混合制作方案", subtitle: "识别风格、整理素材，并生成作品集制作方案", tags: ["素材","字体","混合"] },
  { id: "benchmark", name: "对标拆解", short: "拆", title: "对标链接拆解助手", desc: "拆解爆款视频结构与可迁移方法", subtitle: "只做内容拆解，不下载、不爬取、不违规解析", tags: ["对标","拆解","学习"] },
  { id: "subtitle", name: "字幕优化", short: "字", title: "字幕文案优化助手", desc: "让普通口播更适合短视频观看", subtitle: "优化字幕表达、断句、封面大字与强调关键词", tags: ["字幕","文案","口播"] },
  { id: "fontguide", name: "字体速查", short: "体", title: "剪映字体速查助手", desc: "根据视频风格推荐剪映内置字体搭配", subtitle: "查找适合你视频风格的剪映字体、字号与排版方案", tags: ["字体","剪映","排版"] },
  { id: "music", name: "BGM搜歌", short: "曲", title: "BGM搜歌助手", desc: "根据视频情绪和节奏推荐背景音乐", subtitle: "按风格/情绪/节奏搜歌，推荐剪映曲库和免版权音乐来源", tags: ["音乐","BGM","情绪"] },
  { id: "sfx", name: "音效特效", short: "听", title: "剪映音效特效速查", desc: "快速找到适合的音效和转场特效", subtitle: "按场景查找剪映音效库和特效，含节奏卡点音效指南", tags: ["音效","特效","剪映"] },
  { id: "organize", name: "素材整理", short: "夹", title: "素材库整理助手", desc: "自动生成项目文件夹结构和命名规范", subtitle: "告别乱糟糟的素材库，一键生成分类清晰的文件夹方案", tags: ["整理","素材库","文件夹"] },
  { id: "contract", name: "合同模板", short: "约", title: "接单合同模板生成器", desc: "生成剪辑接单确认书与简易合同", subtitle: "保护双方权益，交付内容、修改次数、付款方式一目了然", tags: ["合同","法律","确认"] }
];

// ---- Navigation ----
function navMarkup() {
  return tools.map((tool, index) => `
    <button type="button" data-view="${tool.id}" class="${index === 0 ? "active" : ""}">
      <span class="nav-symbol">${tool.short}</span>
      <span class="nav-name">${tool.name}</span>
      <span class="nav-arrow">›</span>
    </button>`).join("");
}

function renderNavigation() {
  el("#sideNav").innerHTML = navMarkup();
  el("#mobileNav").innerHTML = navMarkup();
  el("#railNav").innerHTML = tools.map((tool, index) => `
    <button class="rail-button ${index === 0 ? "active" : ""}" type="button" data-view="${tool.id}">
      <span class="icon">${tool.short}</span><span class="tooltip">${tool.name}</span>
    </button>`).join("");
}

// ---- Home Tool List ----
function renderHomeList() {
  el("#homeToolList").innerHTML = tools.slice(1).map((tool, index) => `
    <article class="tool-row">
      <div class="tool-number">${String(index + 1).padStart(2, "0")}</div>
      <div><h4>${tool.title}</h4><p>${tool.desc}</p></div>
      <button class="round-button" type="button" data-view="${tool.id}" aria-label="进入${tool.title}">→</button>
    </article>`).join("");
}

// ---- Update Stats ----
function updateStats() {
  const stats = getStats();
  const total = stats._total || 0;
  const toolCount = tools.length;
  const mostUsedId = Object.entries(stats)
    .filter(([k]) => !k.startsWith("_"))
    .sort(([,a], [,b]) => b - a)[0];
  const mostUsedName = mostUsedId ? (tools.find(t => t.id === mostUsedId[0])?.name || "—") : "—";
  const lastUsed = stats._lastUsed ? new Date(stats._lastUsed).toLocaleDateString("zh-CN") : "—";

  el("#statToolCount").textContent = `${toolCount} 个`;
  el("#statTotalRuns").textContent = `${total} 次`;
  el("#statMostUsed").textContent = mostUsedName;
  el("#statLastUsed").textContent = lastUsed;
}

// ---- View Switching ----
export function switchView(id, options = {}) {
  const tool = tools.find(item => item.id === id) || tools[0];
  all(".view").forEach(view => view.classList.toggle("active", view.id === `view-${id}`));
  all("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === id));
  el("#pageTitle").textContent = tool.title;
  el("#pageSubtitle").textContent = tool.subtitle;

  // Record usage
  if (id !== "home") recordToolUsage(id);

  // Material tab
  if (id === "material" && options.tab) {
    if (typeof switchMaterialTab === "function") switchMaterialTab(options.tab);
  }

  // Mobile
  el("#mobileOverlay").classList.remove("open");
  document.body.style.overflow = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- Sidebar Search ----
function initSearch() {
  const searchInput = el("#sideSearch");
  const searchWrap = el("#sideSearchWrap");
  const searchToggle = el("#searchToggle");
  if (!searchInput || !searchToggle) return;

  // Toggle search visibility
  searchToggle.addEventListener("click", () => {
    const isOpen = !searchWrap.hidden;
    searchWrap.hidden = isOpen;
    searchToggle.classList.toggle("active", !isOpen);
    if (!isOpen) {
      searchInput.focus();
    } else {
      searchInput.value = "";
      // Show all items
      all(".side-nav button[data-view]").forEach(btn => btn.classList.remove("hidden"));
    }
  });

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    const navButtons = all(".side-nav button[data-view]");
    navButtons.forEach(btn => {
      const toolId = btn.dataset.view;
      const tool = tools.find(t => t.id === toolId);
      if (!tool) return;
      const match = !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.desc.toLowerCase().includes(query) ||
        (tool.tags || []).some(tag => tag.toLowerCase().includes(query));
      btn.classList.toggle("hidden", !match);
    });
  });
}

// ---- Keyboard Shortcuts ----
function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + 1~9 = switch tools
    if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if (idx < tools.length && tools[idx].id !== "home") {
        switchView(tools[idx].id);
      }
    }
    // Ctrl/Cmd + 0 = home
    if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      switchView("home");
    }
    // Ctrl/Cmd + Enter = submit active form
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const activeView = document.querySelector(".view.active");
      const form = activeView?.querySelector("form");
      if (form) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
    // Escape = close modals
    if (e.key === "Escape") {
      el("#mobileOverlay")?.classList.remove("open");
      el("#historyPanel")?.classList.remove("open");
      el("#tourOverlay")?.remove();
      document.body.style.overflow = "";
    }
  });
}

// ---- History Panel ----
function initHistoryPanel() {
  const panel = el("#historyPanel");
  const toggleBtn = el("#historyToggle");
  if (!panel || !toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("open");
    if (isOpen) renderHistoryList();
  });

  el("#historyClear")?.addEventListener("click", () => {
    clearHistory();
    renderHistoryList();
    showToast("历史记录已清空。");
  });
}

function renderHistoryList() {
  const list = el("#historyList");
  const history = getHistory();
  if (!history.length) {
    list.innerHTML = '<div class="empty-result" style="min-height:120px"><p>暂无历史记录</p></div>';
    return;
  }
  list.innerHTML = history.map((h, i) => `
    <div class="history-item" data-idx="${i}">
      <div class="tool-name">${h.toolName} · ${new Date(h.time).toLocaleString("zh-CN")}</div>
      <div class="preview">${h.preview}</div>
    </div>`).join("");

  list.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.idx);
      const entry = getHistory()[idx];
      if (entry) {
        switchView(entry.toolId);
        el("#historyPanel").classList.remove("open");
        showToast("已从历史记录进入「" + entry.toolName + "」");
      }
    });
  });
}

// ---- File Upload ----
function initUploadZones() {
  all(".upload-zone").forEach(zone => {
    const input = el("input[type=file]", zone);
    ["dragenter", "dragover"].forEach(type =>
      zone.addEventListener(type, e => { e.preventDefault(); zone.classList.add("dragging"); })
    );
    ["dragleave", "drop"].forEach(type =>
      zone.addEventListener(type, e => { e.preventDefault(); zone.classList.remove("dragging"); })
    );
    zone.addEventListener("drop", e => handleFiles(zone, e.dataTransfer.files));
    input?.addEventListener("change", () => handleFiles(zone, input.files));
  });
}

function handleFiles(zone, files) {
  if (!files?.length) return;
  if (zone.dataset.upload === "image") {
    const file = files[0];
    if (!file.type.startsWith("image/")) return showToast("请选择 JPG、PNG 或 WEBP 图片。");
    const image = el(".preview-image", zone);
    image.src = URL.createObjectURL(file);
    image.style.display = "block";
    el(".upload-copy", zone).style.display = "none";
    const form = zone.closest("form");
    const screenshotInput = form?.querySelector('input[name="screenshot"]');
    if (screenshotInput) screenshotInput.value = file.name;
    showToast(`已读取图片：${file.name}`);
  } else {
    const list = zone.nextElementSibling;
    if (list) {
      list.innerHTML = [...files].map(file =>
        `<div class="file-item"><span>${file.name}</span><span>${formatBytes(file.size)}</span></div>`
      ).join("");
    }
    showToast(`已读取 ${files.length} 个素材文件。`);
  }
}

// ---- Global Event Delegation ----
function initGlobalEvents() {
  document.addEventListener("click", event => {
    // Navigation
    const nav = event.target.closest("[data-view]");
    if (nav) {
      if (typeof switchMaterialTab === "function" && nav.dataset.tab) {
        switchView(nav.dataset.view, { tab: nav.dataset.tab });
      } else {
        switchView(nav.dataset.view);
      }
    }

    // Copy result
    const copy = event.target.closest(".copy-result");
    if (copy) {
      const text = copy.closest(".result-content")?.innerText
        .replace("复制结果", "").replace("复制清单", "").replace("导出 PDF", "") || "";
      navigator.clipboard?.writeText(text)
        .then(() => showToast("结果已复制到剪贴板。"))
        .catch(() => showToast("当前浏览器未开放复制权限。"));
    }

    // Export PDF
    const exportBtn = event.target.closest(".export-pdf");
    if (exportBtn) {
      exportToPdf(exportBtn);
    }
  });
}

// ---- Mobile ----
function initMobile() {
  el("#menuButton")?.addEventListener("click", () => {
    el("#mobileOverlay").classList.add("open");
    document.body.style.overflow = "hidden";
  });
  el("#drawerClose")?.addEventListener("click", () => {
    el("#mobileOverlay").classList.remove("open");
    document.body.style.overflow = "";
  });
  el("#mobileOverlay")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) {
      event.currentTarget.classList.remove("open");
      document.body.style.overflow = "";
    }
  });
}

// ---- Theme ----
function initThemeToggle() {
  const btn = el("#themeToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = toggleTheme();
    btn.textContent = next === "dark" ? "☀️" : "🌙";
  });
  const current = initTheme();
  btn.textContent = current === "dark" ? "☀️" : "🌙";
}

// ---- Guided Tour ----
function initTour() {
  const seen = localStorage.getItem("toolbox_tour_seen");
  if (seen) return;
  if (window.innerWidth < 760) return; // Skip on mobile

  const steps = [
    { icon: "🎬", title: "欢迎使用百宝箱", desc: "这里是剪辑课学员的专属工具箱，帮你完成从接单报价到作品集包装的全流程。" },
    { icon: "📋", title: "13 个实用工具", desc: "左侧是工具导航栏，点击即可切换。推荐从「接单报价助手」开始，按接单流程依次使用。" },
    { icon: "⌨️", title: "快捷键支持", desc: "Ctrl+1~9 快速切换工具，Ctrl+Enter 提交表单，Esc 关闭弹窗。试试看！" }
  ];

  let step = 0;
  const overlay = document.createElement("div");
  overlay.className = "tour-overlay";
  overlay.id = "tourOverlay";

  function render() {
    const s = steps[step];
    overlay.innerHTML = `
      <div class="tour-card">
        <div class="tour-step-icon">${s.icon}</div>
        <h3>${s.title}</h3>
        <p>${s.desc}</p>
        <div class="tour-dots">${steps.map((_, i) => `<div class="tour-dot ${i === step ? "active" : ""}"></div>`).join("")}</div>
        <div class="tour-actions">
          ${step > 0 ? '<button class="secondary-button tour-prev">上一步</button>' : ''}
          <button class="primary-button tour-next">${step === steps.length - 1 ? "开始使用" : "下一步"}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector(".tour-next")?.addEventListener("click", () => {
      if (step < steps.length - 1) {
        step++;
        render();
      } else {
        overlay.remove();
        localStorage.setItem("toolbox_tour_seen", "1");
        showToast("🎉 开始探索吧！试试点击左侧工具导航。");
      }
    });
    overlay.querySelector(".tour-prev")?.addEventListener("click", () => {
      if (step > 0) { step--; render(); }
    });
  }
  render();
}

// ---- Bottom TabBar (Mobile) ----
function initBottomTabBar() {
  const bar = el("#bottomTabBar");
  if (!bar) return;
  // Quick access: home, quote, talk, portfolio
  const tabs = ["home", "quote", "talk", "portfolio"];
  bar.innerHTML = `
    <div class="bottom-tabbar-inner">
      ${tabs.map(id => {
        const t = tools.find(x => x.id === id);
        return `<button class="bottom-tab ${id === "home" ? "active" : ""}" data-view="${id}">
          <span class="tab-icon">${t.short}</span>${t.name}
        </button>`;
      }).join("")}
    </div>`;

  bar.querySelectorAll(".bottom-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
      bar.querySelectorAll(".bottom-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    });
  });
}

// ---- Init ----
export function initApp() {
  renderNavigation();
  renderHomeList();
  updateStats();
  initSearch();
  initKeyboard();
  initHistoryPanel();
  initUploadZones();
  initGlobalEvents();
  initMobile();
  initThemeToggle();
  initBottomTabBar();
  setTimeout(initTour, 800);
}
