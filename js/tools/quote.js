/* 接单报价助手 */
import { el, choice, resultShell, resultCard, resultLayout, simulate, showToast, saveToHistory } from "../utils.js";

export function initQuote() {
  el("#view-quote").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="quoteForm">
        <div class="panel-title"><h3>填写客户需求</h3><span>报价 + 接单流程</span></div>
        <div class="field-grid">
          <div class="field"><label>客户类型</label><select class="control" name="client"><option>个人博主</option><option>商家账号</option><option>课程博主</option><option>探店账号</option><option>本地商家</option><option>其他</option></select></div>
          <div class="field"><label>视频类型</label><select class="control" name="video"><option>口播</option><option>vlog</option><option>探店</option><option>带货</option><option>课程切片</option><option>广告片</option><option>混剪</option></select></div>
          <div class="field"><label>视频时长</label><input class="control" name="duration" placeholder="例如：60 秒" value="60 秒"></div>
          <div class="field"><label>是否需要包装</label>${choice("package", ["是", "否"])}</div>
          <div class="field full"><label>客户要求</label><textarea class="control" name="request" placeholder="例如：需要字幕、花字、简单调色，参考同赛道博主节奏">需要字幕、花字、简单调色，希望整体节奏紧凑，有 1 个参考视频。</textarea></div>
          <div class="field"><label>是否需要脚本协助</label>${choice("script", ["是", "否"], 1)}</div>
          <div class="field"><label>是否加急</label>${choice("urgent", ["是", "否"], 1)}</div>
        </div>
        <div class="form-actions"><span class="form-tip">先看参考、问清片长和素材，再看档期；新客户统一先收 50% 定金。</span><button class="primary-button" type="submit">生成报价接单流程</button></div>
      </form>
      ${resultShell("quoteResult", "生成报价接单流程")}
    </div>`;

  el("#quoteForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const client = data.get("client");
      const video = data.get("video");
      const durationRaw = data.get("duration");
      const durationSec = parseInt(durationRaw) || 60;
      const needPackage = data.get("package") === "是";
      const needScript = data.get("script") === "是";
      const isUrgent = data.get("urgent") === "是";
      const isAd = video === "广告片";
      const isComplex = video === "混剪" || video === "带货" || isAd;
      const timeFactor = durationSec <= 30 ? 0.85 : durationSec <= 90 ? 1.0 : durationSec <= 180 ? 1.3 : 1.6;
      const baseBasic = Math.round((isComplex ? 250 : 180) * timeFactor / 10) * 10;
      const pkgAdd = needPackage ? 0.25 : 0;
      const scriptAdd = needScript ? 0.15 : 0;
      const urgentAdd = isUrgent ? 0.35 : 0;
      const basicPrice = Math.round(baseBasic * (1 + pkgAdd * 0.3 + scriptAdd * 0.3 + urgentAdd) / 10) * 10;
      const standardPrice = Math.round(baseBasic * 2.0 * (1 + pkgAdd + scriptAdd * 0.5 + urgentAdd) / 10) * 10;
      const premiumPrice = Math.round(baseBasic * 3.2 * (1 + pkgAdd + scriptAdd + urgentAdd) / 10) * 10;
      const priceLabel = basicPrice + " - " + premiumPrice + " 元";
      const valueLabel = isComplex ? "账号质感改造" : (needPackage ? "内容包装升级" : "基础剪辑整理");
      const minPrice = Math.min(basicPrice, standardPrice, premiumPrice);
      const maxPrice = Math.max(basicPrice, standardPrice, premiumPrice);
      const dStandard = ["成片 1 条", "结构优化（钩子+节奏+信息层级）", "重点花字/关键词强调", "基础调色", "音乐音效匹配", "2 轮修改", needPackage ? "封面制作" : null].filter(Boolean);
      const orderFlow = [
        "客户发来参考：先说“我先看看哈”，把参考转给负责确认的人或自己先判断能不能接。",
        "能接：先报大概单价，例如“这种我大概是 xxx/min 的哦”，先看客户能不能接受。",
        "客户接受：继续问素材什么时候来、预计成片多长、片子类型和交付时间。",
        "根据素材和难度估算制作周期：例如“我大概要剪 2 天 / 3 天”。",
        "再看档期：能外包的先问外包档期；不能外包的再继续确认自己的档期。",
        "档期确定后：发报价图、注意事项图、出片提示图。",
        "客户确认没问题：新客户收 50% 定金。",
        "收定金后：确认初稿日期，例如“这边就是 xx 号给到初稿哦”。"
      ];
      const copyScript = `哈喽宝~有没有参考呀？

我先看看哈~

宝我看过了，这种我大概是 ${priceLabel}/条 的哦。

好滴，素材啥时候来呀？咱们片子预计要剪多长呢？我看看我要剪多久。

okk，那我大概要剪 ${isUrgent ? "1-2 天" : "2-3 天"}，稍等我看看档期哈。

档期这边可以的话，我把报价、注意事项和出片提示发你。

没问题的话，这边是付 50% 定金的。

收到定金后，我这边就排期，预计 xx 号给到初稿哦。`;
      const dealRules = [
        "新客户 + 老客户新类型：先看参考，确定能不能接，再问片子多长和类型，最后看档期。",
        "看了参考但不确定能不能接：先看素材，再决定能不能接和怎么排档期。",
        "新客户统一收 50% 定金，并备注清楚价格、范围、修改次数、初稿时间。",
        "以后不接包月；档期多就直接约档，客户素材迟到，交付顺延。",
        "定稿给成片时告知客户本条价格；新客户先转尾款，再交付无水印成片。",
        "客户临时新增需求：先确认是否加钱、是否顺延，不要默认免费加。"
      ];

      const html = resultLayout("建议报价区间", priceLabel, [
        resultCard("💡 先判断再报价", "不要拿到需求直接报。" + client + "的" + video + "视频，时长约" + durationSec + "秒——这属于" + valueLabel + "类项目，不是简单代剪。报价前先确认：客户账号阶段、视频用途（涨粉/种草/成交）、是否需要内容判断、是否能作为作品集案例。"),
        resultCard("🟢 基础：" + basicPrice + " 元 | 🟡 标准：" + standardPrice + " 元 | 🔴 深度：" + premiumPrice + " 元", "基于 8 个因素综合计算。基础档 = 纯拼接+字幕；标准档 = 结构优化+花字+调色；深度档 = 风格设计+全包装+脚本协助。"),
        resultCard("标准档包含什么", dStandard),
        resultCard("⚠️ 报价前必须先拿到", ["客户账号主页或想剪的视频", "1个参考账号/视频（他喜欢的风格）", "视频用途（涨粉、种草、成交、建人设）", "素材是否已准备好", "交付时间要求"], true),
        resultCard("📞 AI 小琳式报价话术", "我看了一下你的需求——这是" + valueLabel + "类项目，不只是顺素材剪完，我会帮你重排开头、节奏、重点和包装，让视频更像成熟博主内容。\n\n根据你目前的情况，建议在 " + priceLabel + " 之间。\n\n具体取决于选基础/标准/深度哪个档位和最终素材量。你先确认范围和交期，我给你出详细交付清单。", true),
        resultCard("接单顺序", orderFlow, true),
        resultCard("可复制给客户的流程话术", copyScript, true),
        resultCard("定金 / 档期 / 交付规则", dealRules, true),
        resultCard("🤫 报价后铁律", "1. 报完闭嘴，等客户先回——先说话的人输\n2. 客户说贵 ≠ 真的贵，先诊断不直接降\n3. 降价格必须同时降范围，交付内容不变价格不变"),
        resultCard("📅 跟进节奏", ["当天：发送书面交付清单", "第1天：确认有没有疑问", "第3天：补发一个类似案例", "第7天：确认项目方向是否有变", "第14天：最后跟进（排期提醒）", "14天后：停止。不追。等他找你。"], true)
      ]);

      el("#quoteResult").innerHTML = html;
      saveToHistory("quote", "接单报价助手", "报价区间：" + priceLabel + " | " + client + "·" + video);
    });
  });
}
