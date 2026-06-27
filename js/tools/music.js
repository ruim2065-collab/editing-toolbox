/* BGM搜歌助手 */
import { el, choice, resultShell, resultCard, resultLayout, simulate, saveToHistory } from "../utils.js";
import { moodDB } from "../data/music-db.js";

export function initMusic() {
  el("#view-music").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="musicForm">
        <div class="panel-title"><h3>描述视频情绪</h3><span>BGM搜歌</span></div>
        <div class="field-grid">
          <div class="field"><label>视频类型</label><select class="control" name="type"><option>口播/知识</option><option>vlog/生活</option><option>探店/美食</option><option>带货/种草</option><option>情绪/故事</option><option>混剪/卡点</option><option>综艺/搞笑</option></select></div>
          <div class="field"><label>情绪/氛围</label><select class="control" name="mood"><option>温暖治愈</option><option>积极向上</option><option>紧张悬疑</option><option>轻松愉快</option><option>伤感情绪</option><option>酷炫潮流</option><option>大气磅礴</option></select></div>
          <div class="field"><label>节奏快慢</label><select class="control" name="tempo"><option>慢节奏（抒情）</option><option>中等节奏</option><option>快节奏（卡点）</option><option>由慢到快</option></select></div>
          <div class="field"><label>有无歌词偏好</label>${choice("lyrics", ["纯音乐/轻音乐", "有歌词", "无所谓"], 2)}</div>
          <div class="field full"><label>📎 粘贴视频链接（可选）</label><input class="control" name="link" placeholder="贴视频链接，帮你判断BGM风格和节奏"></div>
          <div class="field full"><label>参考BGM（可选）</label><input class="control" name="ref" placeholder="如果听过类似的，描述一下或写歌名"></div>
        </div>
        <div class="form-actions"><span class="form-tip">本工具推荐音乐风格和剪映曲库关键词，不提供商业MP3下载。商用请确认版权。</span><button class="primary-button" type="submit">搜歌推荐</button></div>
      </form>
      ${resultShell("musicResult", "搜歌推荐")}
    </div>`;

  el("#musicForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const mood = data.get("mood");
      const tempo = data.get("tempo");
      const lyrics = data.get("lyrics");
      const link = data.get("link") || "";
      const info = moodDB[mood] || moodDB["温暖治愈"];
      const lyricTip = lyrics === "纯音乐/轻音乐" ? "纯音乐" : lyrics === "有歌词" ? "有歌词版" : "纯音乐/有歌词均可";

      el("#musicResult").innerHTML = resultLayout("推荐音乐方向", mood + " / " + tempo, [
        resultCard("风格建议", info.style + " / " + lyricTip + " / " + info.bpm),
        resultCard("剪映曲库搜索关键词", info.keywords.join("、")),
        resultCard("免版权音乐来源（免费商用）", ["剪映内置曲库（已授权）", "YouTube Audio Library", "Pixabay Music (pixabay.com/music)", "Uppbeat (uppbeat.io)", "Mixkit (mixkit.co/free-stock-music)"], true),
        resultCard("商用注意", "剪映内置音乐限剪映发布渠道使用。独立商用/广告请使用已购授权音乐。以上免版权来源大多免费商用，使用前请逐个确认具体曲目授权。"),
        resultCard("📎 链接分析", link ? "你贴了视频链接。可以先打开视频感受：它的BGM是快还是慢？有歌词还是纯音乐？情绪是温暖/紧张/活泼？根据你的感受匹配上方的推荐方案。如果不确定，录屏截取一段用听歌识曲。" : "没贴链接。建议贴一个想参考BGM风格的视频链接，帮你分析该用什么音乐。")
      ]);
      saveToHistory("music", "BGM搜歌", `${mood} / ${tempo}`);
    });
  });
}
