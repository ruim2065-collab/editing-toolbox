/* 作品集包装助手 */
import { el, resultShell, resultCard, resultLayout, simulate, saveToHistory } from "../utils.js";

export function initPortfolio() {
  el("#view-portfolio").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="portfolioForm">
        <div class="panel-title"><h3>填写案例信息</h3><span>多平台文案</span></div>
        <div class="field-grid">
          <div class="field"><label>案例类型</label><select class="control" name="type"><option>口播</option><option>vlog</option><option selected>探店</option><option>带货</option><option>课程</option><option>广告</option><option>混剪</option></select></div>
          <div class="field"><label>客户行业</label><input class="control" name="industry" value="本地餐饮"></div>
          <div class="field full"><label>这个案例做了什么</label><textarea class="control" name="work">负责素材筛选、节奏重组、字幕包装、产品特写和门店氛围调色。</textarea></div>
          <div class="field full"><label>亮点描述</label><textarea class="control" name="highlight">前三秒直接展示招牌产品，信息密度高但画面不乱，整体节奏适合本地生活账号。</textarea></div>
          <div class="field"><label>是否有数据结果</label><input class="control" name="data" placeholder="没有可填写：暂无公开数据" value="完播率比往期提升 18%"></div>
          <div class="field"><label>想发布的平台</label><select class="control" name="platform"><option>小红书</option><option>抖音</option><option>朋友圈</option><option>简历</option><option>接单页</option></select></div>
        </div>
        <div class="form-actions"><span class="form-tip">数据结果请使用真实数据，没有数据也可以突出服务过程和交付价值。</span><button class="primary-button" type="submit">生成作品集文案</button></div>
      </form>
      ${resultShell("portfolioResult", "生成作品集文案")}
    </div>`;

  el("#portfolioForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const type = data.get("type");
      const industry = data.get("industry");
      const work = data.get("work");
      const highlight = data.get("highlight");
      const resultData = data.get("data");

      el("#portfolioResult").innerHTML = resultLayout("作品集标题", `本地餐饮${type}案例｜从素材整理到成片包装`, [
        resultCard("案例介绍", `${work} 通过重新设计前三秒信息、调整素材顺序和统一字幕视觉，让案例更适合短视频平台观看。`, true),
        resultCard("我的服务亮点", ["能从客户目标反推剪辑重点", "不仅剪顺，还会处理信息层级", "交付前主动检查字幕、声音和画幅"]),
        resultCard("展示给客户的话术", `这是我为${industry}账号制作的案例，重点处理了前三秒产品展示、字幕信息和门店氛围。如果您的账号也需要稳定更新同类内容，我可以按统一模板长期协作。`),
        resultCard("小红书发布版", `剪辑作品集更新｜这次做的是${industry}${type}案例。相比堆转场，我更关注前三秒有没有吸引力、产品特写是否清楚，以及字幕会不会抢画面。`, true),
        resultCard("朋友圈发布版", `更新一条${industry}剪辑案例：素材整理、节奏重组、字幕包装、基础调色均由我完成。目前可承接${type}、探店和本地生活类短视频剪辑。`),
        resultCard("简历 / 接单页展示版", `项目类型：${type}短视频｜负责内容：素材筛选、结构调整、字幕包装、声音处理与调色｜结果：${resultData}`)
      ]);
      saveToHistory("portfolio", "作品集包装助手", `${industry} ${type}案例 · 多平台文案`);
    });
  });
}
