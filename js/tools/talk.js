/* 客户沟通话术助手 */
import { el, choice, resultShell, resultCard, resultLayout, simulate, showToast, saveToHistory } from "../utils.js";
import { talkDB, goalLabels } from "../data/talk-db.js";

export function initTalk() {
  el("#view-talk").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="talkForm">
        <div class="panel-title"><h3>输入沟通场景</h3><span>三种边界强度</span></div>
        <div class="field-grid">
          <div class="field full"><label>当前沟通场景</label><select class="control" name="scene"><option>初次咨询</option><option selected>客户压价</option><option>客户催稿</option><option>客户反复修改</option><option>客户需求不清楚</option><option>客户临时加需求</option></select></div>
          <div class="field full"><label>客户原话</label><textarea class="control" name="words" placeholder="粘贴客户发来的原话">别人 100 元就能做，你这边能不能便宜一点？后面还有很多视频。</textarea></div>
          <div class="field full"><label>我的目标</label>${choice("goal", ["想成交", "想涨价", "想拒绝", "想解释", "想确认需求"], 1)}</div>
        </div>
        <div class="form-actions"><span class="form-tip">建议根据客户关系选择语气，不要一次发送全部版本。</span><button class="primary-button" type="submit">生成回复话术</button></div>
      </form>
      ${resultShell("talkResult", "生成回复话术")}
    </div>`;

  el("#talkForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const scene = data.get("scene");
      const goal = data.get("goal");
      const words = data.get("words") || "";
      const info = talkDB[scene] || talkDB["客户压价"];

      const wordsLower = words.toLowerCase();
      const isPriceOnly = words.length < 20 && (words.includes("钱") || words.includes("价") || words.includes("多少"));
      const isBargain = words.includes("便宜") || words.includes("贵") || words.includes("优惠");
      const isVague = words.includes("好看") || words.includes("高级") || words.includes("感觉") || words.includes("随便");
      const isUrgent = words.includes("急") || words.includes("快") || words.includes("马上");
      const clientType = isPriceOnly ? "低预算试探型" : isBargain ? "价格敏感型" : isVague ? "需求模糊型" : isUrgent ? "急单型" : "待判断";

      // Adjust script based on goal
      let script = info.script;
      if (goal === "想拒绝") {
        script = talkDB[scene]?.script || info.script;
        if (scene === "客户压价") script = "理解。当前价格是按交付内容核算的，如果预算不匹配也完全理解。建议你找更匹配你预算的剪辑师，以后有合适的项目再联系。";
        else if (scene === "客户临时加需求") script = "这个需求不在原范围内。如果要加，费用增加X元，交期顺延Y天。或者你先把原定内容确认交付，这个作为追加单处理。你定哪个？";
      } else if (goal === "想解释" && scene === "客户压价") {
        script = "我先说一下这个价格包含什么：不只是剪顺，而是重排开头、节奏、重点和包装——让视频更像成熟博主内容，不是普通代剪。如果你只需要基础拼接，有更便宜的选择。";
      } else if (goal === "想确认需求" && scene === "客户需求不清楚") {
        script = `好的，我先帮你缩小范围：
你更喜欢哪种感觉？
A. 干净克制（少即是多，大博主感）
B. 网感热闹（花字音效，综艺感）
C. 商业质感（品牌感，适合接广告）
另外发1-2个你觉得做得好的视频给我参考。`;
      }

      el("#talkResult").innerHTML = resultLayout(
        "场景：" + scene + " | 目标：" + goal,
        "客户类型判断：" + clientType + " | " + (goalLabels[goal] || ""),
        [
          resultCard("AI 小琳式判断", info.judgment, true),
          resultCard("现实判断", info.reality, true),
          resultCard("回复话术（可直接发）", script, true),
          resultCard("最优先动作", info.action),
          resultCard("如果不行怎么办", info.fallback),
          resultCard("⚠️ 核心原则", info.tips)
        ]
      );
      saveToHistory("talk", "沟通话术助手", "场景：" + scene + " | 目标：" + goal + " | 客户：" + clientType);
    });
  });
}
