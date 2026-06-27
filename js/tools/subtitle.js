/* 字幕文案优化助手 */
import { el, choice, resultShell, resultCard, resultLayout, simulate, saveToHistory } from "../utils.js";

export function initSubtitle() {
  el("#view-subtitle").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="subtitleForm">
        <div class="panel-title"><h3>粘贴原始口播文案</h3><span>短视频表达</span></div>
        <div class="field-grid">
          <div class="field full"><label>原始口播文案</label><textarea class="control" name="content" style="min-height:190px">大家好，今天想和大家分享一下，我最近在学习剪辑的时候发现，其实很多新手不是不会用软件，而是不知道应该做什么作品，也不知道怎么拿作品去接单。</textarea></div>
          <div class="field"><label>视频类型</label><select class="control" name="type"><option selected>口播</option><option>探店</option><option>vlog</option><option>带货</option><option>教程</option><option>课程</option><option>情绪表达</option></select></div>
          <div class="field"><label>想要风格</label><select class="control" name="style"><option>自然口语</option><option selected>干净专业</option><option>情绪强一点</option><option>小红书感</option><option>成交感</option></select></div>
          <div class="field full"><label>是否需要封面标题</label>${choice("cover", ["是", "否"])}</div>
        </div>
        <div class="form-actions"><span class="form-tip">优化会减少口头废话，但不会改变原文核心意思。</span><button class="primary-button" type="submit">优化字幕文案</button></div>
      </form>
      ${resultShell("subtitleResult", "优化字幕文案")}
    </div>`;

  el("#subtitleForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      el("#subtitleResult").innerHTML = resultLayout("优化完成", `${data.get("type")} · ${data.get("style")}`, [
        resultCard("优化后的字幕版", "很多剪辑新手，卡住的不是软件。\n而是学完之后，不知道该做什么作品。\n更不知道，怎么拿作品去接单。\n\n所以第一步，不是继续学更多功能。\n而是先做一套客户看得懂的作品集。", true),
        resultCard("可做封面大字的句子", "剪辑新手接不到单，可能不是技术问题"),
        resultCard("建议强调的关键词", `<span class="result-tag">不是软件</span><span class="result-tag">做什么作品</span><span class="result-tag">拿作品接单</span><span class="result-tag">客户看得懂</span>`),
        resultCard("字幕断句建议", ["每行控制在 8-14 个字", "转折词单独成句", "结论句停留时间略长", "重点句前后留 0.2-0.4 秒呼吸"]),
        resultCard("不建议保留的废话", ""大家好""今天想和大家分享一下""我最近在学习的时候发现"可直接删除或压缩。", true)
      ]);
      saveToHistory("subtitle", "字幕文案优化", `${data.get("type")} · ${data.get("style")}`);
    });
  });
}
