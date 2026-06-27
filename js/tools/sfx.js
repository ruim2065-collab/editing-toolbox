/* 剪映音效特效速查 */
import { el, resultShell, resultCard, resultLayout, simulate, saveToHistory } from "../utils.js";
import { sfxDB, vfxDB, getRhythmTip } from "../data/sfx-db.js";

export function initSfx() {
  el("#view-sfx").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="sfxForm">
        <div class="panel-title"><h3>选择需要的效果</h3><span>剪映音效特效</span></div>
        <div class="field-grid">
          <div class="field"><label>视频类型</label><select class="control" name="type"><option>口播/知识</option><option>vlog/生活</option><option>探店/美食</option><option>带货/种草</option><option>综艺/搞笑</option><option>混剪/卡点</option></select></div>
          <div class="field"><label>需要的音效类型</label><select class="control" name="sfxType"><option>转场音效（嗖、呼、唰）</option><option>提示音（叮、弹出、确认）</option><option>氛围音（环境、自然、城市）</option><option>动作音（脚步、开门、放东西）</option><option>卡点音效（鼓点、重音）</option><option>搞笑音效（滑倒、尴尬、惊讶）</option><option>综艺感（鼓掌、欢呼、笑声）</option></select></div>
          <div class="field"><label>需要的特效类型</label><select class="control" name="vfxType"><option>转场特效</option><option>画面特效（发光/震动/模糊）</option><option>文字动画</option><option>贴纸/表情</option><option>分屏/画中画</option><option>不需要特效，只要音效</option></select></div>
          <div class="field full"><label>📎 粘贴视频链接（可选）</label><input class="control" name="link" placeholder="贴视频链接，帮你拆解里面的音效和特效用法"></div>
          <div class="field"><label>节奏风格</label><select class="control" name="rhythm"><option>干净克制</option><option>适中节奏</option><option>强节奏/综艺感</option></select></div>
        </div>
        <div class="form-actions"><span class="form-tip">音效和特效名称基于剪映当前版本，以剪映内实际显示为准。</span><button class="primary-button" type="submit">查找音效特效</button></div>
      </form>
      ${resultShell("sfxResult", "查找音效特效")}
    </div>`;

  el("#sfxForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const sfxType = data.get("sfxType");
      const vfxType = data.get("vfxType");
      const rhythm = data.get("rhythm");
      const link = data.get("link") || "";
      const s = sfxDB[sfxType] || sfxDB["转场音效（嗖、呼、唰）"];
      const v = vfxDB[vfxType] || vfxDB["转场特效"];
      const rm = getRhythmTip(rhythm);

      el("#sfxResult").innerHTML = resultLayout("音效特效推荐", sfxType, [
        resultCard("推荐音效", s.sfx),
        resultCard("剪映音效库搜索", "音频-音效中搜索：" + s.search),
        resultCard("音效使用技巧", s.tip),
        resultCard("推荐特效", v.vfx),
        resultCard("剪映特效搜索", v.search ? "特效中搜索：" + v.search : "不需要特效"),
        resultCard("特效使用技巧", v.tip),
        resultCard("节奏风格建议", rm, true),
        resultCard("📎 链接参考", link ? "你贴了视频链接。可以打开观察：转场用的什么类型（叠化/滑动/闪白）？音效出现在哪些位置（转场/卡点/重点文字）？特效是克制还是堆叠？记录下来就是你的音效参考库。" : "没贴链接。建议贴一个参考视频，帮你拆解里面的音效和特效用法。")
      ]);
      saveToHistory("sfx", "音效特效速查", sfxType);
    });
  });
}
