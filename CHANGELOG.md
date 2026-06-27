# CHANGELOG

## v2.1.0 (2026-06-28) — 架构升级 + 功能增强

### 🏗 架构拆分
- 1640 行单文件 → 模块化架构：独立 CSS、18 个 JS 模块
- ES Modules：`js/utils.js`、`js/app.js`、`js/ai.js`
- 工具模块：`js/tools/` 下 13 个独立文件
- 数据模块：`js/data/` 下 4 个数据库文件

### 🔴 安全修复 (P0)
- `API_BASE` 硬编码 URL → 相对路径 `/api`
- Android keystore 密码 → GitHub Secrets (`${{ secrets.KEYSTORE_PASSWORD }}`)
- Android `usesCleartextTraffic="true"` → `network_security_config.xml` 限定域名白名单

### 🆕 新增功能
- **第 13 个工具：合同模板生成器** — 生成项目确认书，含交付内容、修改次数、付款方式
- **AI API 集成** (`js/ai.js`) — 支持配置 Claude API 密钥启用真实 AI 生成
- **localStorage 历史记录** — 50 条历史，支持浏览和回溯
- **PDF 导出** — 所有工具结果可一键导出打印
- **首页动态统计** — 内置工具数、历史使用次数、最常用工具、最近使用时间
- **暗色模式** — 左侧底栏切换，状态持久化到 localStorage
- **键盘快捷键** — Ctrl+1~9 切换工具、Ctrl+Enter 提交、Esc 关闭
- **侧栏搜索框** — 按名称/描述/标签过滤工具
- **3 步新手指引** — 首次访问自动弹出引导卡片
- **移动端底部 TabBar** — 首页/报价/话术/作品集快捷切换

### 🔧 改进
- Service Worker 缓存策略优化：shell cache-first, JS stale-while-revalidate, API network-first
- PWA manifest 增强：categories、screenshots、related_applications
- JSON-LD 结构化数据
- Open Graph 标签
- Android WebView 离线回退（远程失败自动加载本地 bundle）
- 新增 `android:networkSecurityConfig` 替换 `usesCleartextTraffic`

### 📁 文件结构
```
editing-toolbox/
  index.html              # 壳：布局 + 路由 + PWA (220行, 原来1640行)
  css/main.css            # 完整样式 (含暗色模式)
  js/
    utils.js              # 工具函数 (DOM/Toast/结果模板/历史/统计/主题/PDF)
    app.js                # 主应用 (路由/导航/搜索/快捷键/引导/移动端)
    ai.js                 # AI 集成 (Claude API / 兼容端点)
    data/
      talk-db.js          # 话术场景数据库
      font-db.js          # 字体数据库
      music-db.js         # 音乐数据库
      sfx-db.js           # 音效数据库
    tools/
      quote.js            # 接单报价助手
      talk.js             # 客户沟通话术
      revision.js         # 修改意见整理
      portfolio.js        # 作品集包装
      material.js         # 素材辅助 (字体+混合)
      benchmark.js        # 对标拆解
      subtitle.js         # 字幕优化
      fontguide.js        # 字体速查
      music.js            # BGM搜歌
      sfx.js              # 音效特效
      organize.js         # 素材库整理
      contract.js         # 合同模板 (新)
  api/fetch.js            # Vercel Serverless 链接抓取
  sw.js                   # Service Worker (优化策略)
  manifest.json           # PWA 清单 (增强)
  CHANGELOG.md            # 本文件
```

---

## v2.0.0 (2026-06-25)
- 12 合 1 单文件 PWA 初版
- 新拟态银灰 UI 设计
- 桌面 + 移动端响应式
- Vercel API 链接识别
- Android WebView 封装
- GitHub Actions 自动打包 APK
