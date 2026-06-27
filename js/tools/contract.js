/* 合同模板生成器 — 新增第13个工具 */
import { el, choice, resultShell, resultCard, resultLayout, simulate, saveToHistory } from "../utils.js";

export function initContract() {
  el("#view-contract").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="contractForm">
        <div class="panel-title"><h3>填写项目基本信息</h3><span>生成确认书</span></div>
        <div class="field-grid">
          <div class="field"><label>你的名字/工作室</label><input class="control" name="editor" placeholder="例如：小陈剪辑" value="剪辑师"></div>
          <div class="field"><label>客户名称</label><input class="control" name="client" placeholder="客户/公司名称" value="客户"></div>
          <div class="field"><label>项目类型</label><select class="control" name="type"><option>短视频剪辑</option><option>口播剪辑</option><option>vlog剪辑</option><option>探店视频</option><option>带货视频</option><option>课程切片</option><option>广告片</option></select></div>
          <div class="field"><label>视频数量</label><input class="control" name="count" value="1 条"></div>
          <div class="field full"><label>交付内容描述</label><textarea class="control" name="deliverables" placeholder="详细列出交付内容">1. 成片 1 条（含字幕、基础调色、BGM）
2. 封面图 1 张
3. 可修改 2 轮（小改范围：错字、局部音量、字幕位置）</textarea></div>
          <div class="field"><label>交付时间</label><input class="control" name="deadline" placeholder="例如：2026年7月5日" value="2026年7月5日"></div>
          <div class="field"><label>项目费用</label><input class="control" name="price" placeholder="例如：800 元" value="800 元"></div>
          <div class="field"><label>付款方式</label><select class="control" name="payment"><option>确认后付 50% 定金，交付前付清尾款</option><option>确认后全额预付</option><option>交付后 3 日内付清</option></select></div>
          <div class="field"><label>修改轮数上限</label><select class="control" name="revisions"><option>2 轮</option><option>3 轮</option><option>1 轮</option></select></div>
          <div class="field full"><label>补充条款（可选）</label><textarea class="control" name="extra" placeholder="其他约定事项">超出修改轮数范围的新增需求，按次单独计费（100 元/轮）。加急交付加收 30% 急单费。素材由客户提供，版权问题由客户自行负责。</textarea></div>
          <div class="field"><label>是否包含源文件</label>${choice("source", ["是，交付剪映工程文件", "否，仅交付成片"], 1)}</div>
          <div class="field"><label>是否需要双方签署</label>${choice("sign", ["是，生成签署区", "否，仅做参考"], 1)}</div>
        </div>
        <div class="form-actions"><span class="form-tip">本模板仅供学习参考，正式合同请咨询法律专业人士。</span><button class="primary-button" type="submit">生成合同模板</button></div>
      </form>
      ${resultShell("contractResult", "生成合同模板")}
    </div>`;

  el("#contractForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const editor = data.get("editor") || "剪辑师";
      const client = data.get("client") || "客户";
      const type = data.get("type");
      const count = data.get("count") || "1 条";
      const deliverables = data.get("deliverables") || "";
      const deadline = data.get("deadline") || "";
      const price = data.get("price") || "";
      const payment = data.get("payment") || "";
      const revisions = data.get("revisions") || "2 轮";
      const extra = data.get("extra") || "";
      const includeSource = data.get("source")?.includes("是");
      const needSign = data.get("sign")?.includes("是");
      const today = new Date().toLocaleDateString("zh-CN");

      const contractText = [
        "═══════════════════════════════",
        "  视频剪辑服务确认书",
        "═══════════════════════════════",
        "",
        `日期：${today}`,
        "",
        "一、双方信息",
        `  剪辑方（乙方）：${editor}`,
        `  委托方（甲方）：${client}`,
        "",
        "二、项目内容",
        `  项目类型：${type}`,
        `  数量：${count}`,
        "",
        "三、交付内容",
        ...deliverables.split("\n").map(l => `  · ${l}`),
        "",
        "四、交付时间",
        `  约定交付日期：${deadline}`,
        "  如需加急，加收 30% 急单费，交付时间另行协商。",
        "",
        "五、费用与付款",
        `  项目费用：${price}`,
        `  付款方式：${payment}`,
        "",
        "六、修改条款",
        `  免费修改上限：${revisions}`,
        "  小改范围：错字、局部音量、字幕位置调整",
        "  超出范围的结构调整、风格变化、素材替换按次计费",
        `  ${extra ? "补充条款：" + extra : ""}`,
        "",
        `七、源文件${includeSource ? "交付" : "不交付"}`,
        `  ${includeSource ? "交付剪映工程文件，甲方可自行修改" : "仅交付最终成片（MP4），工程文件由乙方保留"}`,
        "",
        "八、版权说明",
        "  甲方提供的原始素材版权由甲方负责。",
        "  乙方保留作品集展示权（可在作品集中展示该案例）。",
        "  如甲方不希望公开展示，请在签署前注明。",
        "",
        "九、违约责任",
        "  乙方未按时交付的，每延迟 1 天减免 5% 费用。",
        "  甲方未按时支付费用的，乙方有权暂停交付。",
        "  因甲方原因导致项目取消的，已付定金不予退还。",
        "",
        ...(needSign ? [
          "",
          "  甲方确认：________________",
          `  日期：____年____月____日`,
          "",
          "  乙方确认：________________",
          `  日期：____年____月____日`,
        ] : [
          "",
          "（本确认书为参考模板，正式签约请咨询律师）"
        ]),
        "",
        "═══════════════════════════════"
      ].join("\n");

      el("#contractResult").innerHTML = `
        <div class="result-content">
          <div class="result-hero"><small>合同确认书</small><h4>${type} · ${price}</h4></div>
          <div class="result-grid">
            ${resultCard("合同预览（可复制）", contractText, true)}
            ${resultCard("📋 发送给客户前请检查", [
              "✓ 客户名称是否正确",
              "✓ 交付内容是否完整",
              "✓ 价格和付款方式是否确认",
              "✓ 交付时间是否合理（留缓冲）",
              "✓ 修改次数是否明确",
              "✓ 补充条款是否遗漏"
            ], true)}
            ${resultCard("📞 发送话术", `Hi，我整理了一份项目确认书，把咱们聊的内容写清楚了。你看一下交付内容、时间和费用有没有问题。确认没问题回复"确认"，我就按这个开始做。`, true)}
            ${resultCard("⚠️ 重要提醒", [
              "这是参考模板，不是正式法律文件",
              "大额项目（>5000元）建议使用正式合同",
              "合作前确认客户身份和支付能力",
              "保留所有聊天记录和变更确认记录",
              "遇到纠纷：先沟通 → 聊天记录 → 平台投诉 → 法律途径"
            ])}
          </div>
          <div class="result-toolbar">
            <button class="secondary-button copy-result" type="button">复制合同全文</button>
            <button class="export-button export-pdf" type="button">导出 PDF</button>
          </div>
        </div>`;
      saveToHistory("contract", "合同模板", `${type} · ${price} · ${client}`);
    });
  });
}
