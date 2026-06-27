/* 剪映字体速查助手 */
import { el, choice, resultShell, resultCard, resultLayout, simulate, saveToHistory } from "../utils.js";
import { fontDB, positionTips } from "../data/font-db.js";

export function initFontguide() {
  el("#view-fontguide").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="fontguideForm">
        <div class="panel-title"><h3>选择视频风格</h3><span>剪映字体速查</span></div>
        <div class="field-grid">
          <div class="field"><label>视频类型</label><select class="control" name="type"><option>口播/知识</option><option>vlog/生活</option><option>探店/美食</option><option>带货/种草</option><option>课程/教程</option><option>情绪/故事</option><option>综艺/搞笑</option></select></div>
          <div class="field"><label>使用位置</label><select class="control" name="position"><option>封面标题</option><option>视频字幕</option><option>重点花字</option><option>人名条/标签</option><option>结尾引流</option></select></div>
          <div class="field"><label>风格感觉</label><select class="control" name="style"><option>干净高级</option><option>可爱活泼</option><option>商业质感</option><option>网感综艺</option><option>文艺情绪</option><option>科技简约</option></select></div>
          <div class="field full"><label>📎 粘贴视频/截图链接（可选）</label><input class="control" name="link" placeholder="贴一个你想参考字体的视频链接，帮你判断字体方向"></div>
          <div class="field"><label>是否商用</label>${choice("license", ["是，商用单", "否，个人练习"], 1)}</div>
        </div>
        <div class="form-actions"><span class="form-tip">字体建议基于剪映当前内置字体库，实际字体随版本更新变化。</span><button class="primary-button" type="submit">查询字体方案</button></div>
      </form>
      ${resultShell("fontguideResult", "查询字体方案")}
    </div>`;

  el("#fontguideForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const style = data.get("style");
      const position = data.get("position");
      const link = data.get("link") || "";
      const info = fontDB[style] || fontDB["干净高级"];
      const posTip = positionTips[position] || "";

      el("#fontguideResult").innerHTML = resultLayout("推荐字体", style + " / " + position, [
        resultCard("中文推荐", info.cn.join("、")),
        resultCard("剪映内搜索", info.cn.slice(0, 2).join("、") + " / 在剪映文字-字体中直接搜索"),
        resultCard("排版建议", info.tip),
        resultCard(position + "专属建议", posTip),
        resultCard("📎 链接参考提示", link
          ? "你贴了链接：分析目标视频的风格倾向。如果视频偏干净克制→选无衬线字体；偏综艺热闹→选粗体撞色；偏文艺情绪→选衬线/手写体。具体推荐见上方。"
          : "没贴链接。建议贴一个参考视频链接，我能帮你判断字体方向。")
      ]);
      saveToHistory("fontguide", "字体速查", `${style} / ${position}`);
    });
  });
}
