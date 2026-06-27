# Design QA

## Visual target

- 用户提供的银灰色双层侧栏后台参考图。
- 用户提供的圆润银灰实体按钮与输入控件参考图。

## Checked states

- Desktop: 1280 × 720
- Mobile: 390 × 844
- Home dashboard (dynamic stats)
- Quote tool navigation and generated result
- Mobile drawer navigation and bottom tab bar
- Dark mode toggle
- All 13 tools: forms + results + export

## v2.1 Changes

- P0: API_BASE → relative path; Android keystore → GitHub Secrets; Android usesCleartextTraffic → network_security_config.xml
- P1: Monolith split into 18 JS modules + 1 CSS + shell HTML
- P2: New contract tool (13th); AI API integration; localStorage history; PDF export; dynamic stats
- P3: Keyboard shortcuts (Ctrl+1~9); sidebar search; dark mode; mobile bottom tab bar; guided tour; improved SW caching
- P4: CHANGELOG.md; enhanced manifest.json; Android offline fallback; JSON-LD + OG tags

## Findings

- P0: none
- P1: none
- P2: none
- P3: 图标采用中文单字标识，以保证单文件离线打开时不依赖外部图标服务；后续如接入正式图标库，可替换为统一线性图标。

## Verification

- 13 个工具入口正常显示。
- 13 个表单与对应结果容器完整存在。
- 报价助手可生成模拟报价结果。
- 合同模板生成确认书。
- 暗色模式切换正常、持久化到 localStorage。
- 移动端导航抽屉可打开并切换页面。
- 移动端底部 TabBar 正常显示。
- 390px 视口无横向溢出。
- 浏览器控制台无错误。
- 页面未出现限制词。
- Service Worker 注册成功。
- 历史记录面板正常工作。
- 搜索结果实时过滤。

final result: passed
