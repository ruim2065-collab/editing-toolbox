/* 剪映字体速查助手 */
import { el, resultShell } from "../utils.js";

export function initFontguide() {
  el("#view-fontguide").innerHTML = `
    <div class="tool-layout vision-tool-layout">
      <form class="form-panel surface" id="fontVisionForm">
        <div class="panel-title"><h3>上传截图识别具体字体</h3><span>字体库匹配</span></div>
        <div class="upload-zone" data-upload="vision-font">
          <input type="file" accept="image/jpeg,image/png,image/webp">
          <div class="upload-copy"><div class="upload-symbol">＋</div><strong>上传参考截图</strong><p>支持 JPG / PNG / WEBP。尽量裁剪到文字区域、保留完整字形。</p></div>
          <img class="preview-image" alt="字体截图预览">
        </div>
        <div class="vision-status" data-state="idle">等待上传截图。</div>
        <div class="form-actions"><span class="form-tip">优先匹配自建剪映/Capcut字体库，先给具体字体名，再给类似字体。</span><button class="primary-button" type="submit">识别字体</button></div>
      </form>
      ${resultShell("fontVisionResult", "识别字体")}
    </div>`;
}
