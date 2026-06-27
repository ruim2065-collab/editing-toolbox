/* 素材辅助工具 (字体识别 + 混合制作) */
import { el, choice, resultShell, resultCard, resultLayout, simulate, showToast, saveToHistory } from "../utils.js";

export function switchMaterialTab(tab) {
  const isFont = tab === "font";
  el("#materialFont").hidden = !isFont;
  el("#materialMix").hidden = isFont;
  const input = el(`#materialTabs input[value="${tab}"]`);
  if (input) input.checked = true;
}

export function initMaterial() {
  el("#view-material").innerHTML = `
    <div class="surface" style="padding:10px;margin-bottom:18px">
      <div class="choice-row" id="materialTabs">
        <label class="choice"><input type="radio" name="materialTab" value="font" checked><span>封面 / 字幕字体识别</span></label>
        <label class="choice"><input type="radio" name="materialTab" value="mix"><span>图片 / 视频混合制作</span></label>
      </div>
    </div>
    <div id="materialFont">
      <div class="tool-layout">
        <form class="form-panel surface" id="fontForm">
          <div class="panel-title"><h3>上传截图并描述风格</h3><span>模拟识别</span></div>
          <div class="upload-zone" data-upload="image">
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/*">
            <div class="upload-copy"><div class="upload-symbol">＋</div><strong>拖拽或点击上传截图</strong><p>支持 JPG / PNG / WEBP，第一版只做本地预览</p></div>
            <img class="preview-image" alt="上传图片预览">
          </div>
          <div class="field-grid" style="margin-top:17px">
            <div class="field full"><label>输入截图中的文字</label><input class="control" name="text" value="剪辑小白如何开始接单"></div>
            <div class="field"><label>选择用途</label><select class="control" name="use"><option>封面大字</option><option>视频字幕</option><option>标题字</option><option>海报字</option></select></div>
            <div class="field"><label>选择风格</label><select class="control" name="style"><option>干净高级</option><option>可爱活泼</option><option>商业感</option><option>情绪感</option><option>教程感</option></select></div>
          </div>
          <div class="form-actions"><span class="form-tip">第一版不接真实 OCR 与字体库，结果用于排版方向参考。</span><button class="primary-button" type="submit">开始识别字体</button></div>
        </form>
        ${resultShell("fontResult", "开始识别字体")}
      </div>
    </div>
    <div id="materialMix" hidden>
      <div class="tool-layout">
        <form class="form-panel surface" id="mixForm">
          <div class="panel-title"><h3>上传图片或视频素材</h3><span>制作方案</span></div>
          <div class="upload-zone" data-upload="files">
            <input type="file" multiple accept="image/*,video/*">
            <div class="upload-copy"><div class="upload-symbol">＋</div><strong>拖拽或点击上传素材</strong><p>支持常见图片与视频格式，仅显示文件名，不上传服务器</p></div>
          </div>
          <div class="file-list"></div>
          <div class="field-grid" style="margin-top:17px">
            <div class="field"><label>制作类型</label><select class="control" name="type"><option>作品集展示</option><option>客户案例包装</option><option>小红书封面图</option><option>接单介绍页</option><option>朋友圈展示</option></select></div>
            <div class="field"><label>选择风格</label><select class="control" name="style"><option>干净高级</option><option>小红书感</option><option>商单感</option><option>教程感</option><option>情绪感</option></select></div>
            <div class="field"><label>选择画幅</label>${choice("ratio", ["9:16", "16:9", "1:1"])}</div>
            <div class="field full"><label>想表达的卖点</label><textarea class="control" name="selling">突出我会做节奏、字幕包装、调色和商单案例整理，适合口播与本地生活账号。</textarea></div>
          </div>
          <div class="form-actions"><span class="form-tip">第一版不做真实合成与导出，只生成剪映制作方案。</span><button class="primary-button" type="submit">生成制作方案</button></div>
        </form>
        ${resultShell("mixResult", "生成制作方案")}
      </div>
    </div>`;

  el("#materialTabs").addEventListener("change", event => switchMaterialTab(event.target.value));

  el("#fontForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      el("#fontResult").innerHTML = resultLayout("模拟识别结果", "现代无衬线粗体 · 相似度 82%", [
        resultCard("可能相似字体", "思源黑体 Heavy / 阿里巴巴普惠体 Bold / HarmonyOS Sans SC Black"),
        resultCard("剪映可替代字体", "优先尝试：得意黑、雅月体、系统黑体加粗。具体字体名称会随剪映版本变化。"),
        resultCard("适合的视频类型", `<span class="result-tag">${data.get("use")}</span><span class="result-tag">教程口播</span><span class="result-tag">干货封面</span>`, true),
        resultCard("字幕 / 封面排版建议", ["两行以内，每行 8-12 个字", "关键词可放大 15%-20%", "文字与背景保持明显明暗对比", "不要同时使用超过两种字重"]),
        resultCard("是否适合新手模仿", "适合。字体本身克制，重点在字号层级、字间距和留白，不依赖复杂特效。"),
        resultCard("注意事项", "模拟结果不能替代字体授权判断；商用前请确认字体许可证。")
      ]);
      saveToHistory("material", "字体识别", "识别结果：现代无衬线粗体 · 相似度 82%");
    });
  });

  el("#mixForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      el("#mixResult").innerHTML = resultLayout("推荐方案", `${data.get("type")} · ${data.get("style")} · ${data.get("ratio")}`, [
        resultCard("推荐画面结构", ["0-3 秒：最强案例画面 + 服务定位", "3-10 秒：展示原素材与处理后对比", "10-22 秒：按能力拆分代表片段", "结尾：服务范围与联系方式"]),
        resultCard("开头文案", "不是只会剪顺，我会把素材整理成客户看得懂、愿意下单的作品。"),
        resultCard("展示顺序", "先放最成熟案例，再放字幕包装和节奏对比，最后补充服务范围与合作方式。", true),
        resultCard("字幕建议", "统一左对齐或居中布局；主标题 1 个字重，解释信息降低 20% 对比度。"),
        resultCard("BGM 氛围建议", "选择节奏清晰、不过度抢戏的轻电子或简约律动音乐，卡点以段落转换为主。"),
        resultCard("适合发布的平台", "小红书、抖音、朋友圈、接单介绍页"),
        resultCard("后续用剪映怎么做", ["先建立统一画幅与安全区", "按案例建复合片段", "统一字幕样式后批量应用", "最后做音乐节奏和音量检查"], true)
      ]);
      saveToHistory("material", "混合制作", `${data.get("type")} · ${data.get("style")}`);
    });
  });
}
