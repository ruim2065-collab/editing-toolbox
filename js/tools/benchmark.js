/* 对标链接拆解助手 */
import { el, resultShell, resultCard, resultLayout, simulate, saveToHistory } from "../utils.js";

export function initBenchmark() {
  el("#view-benchmark").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="benchmarkForm">
        <div class="panel-title"><h3>链接识别 + 截图补充</h3><span>稳定拆解</span></div>
        <div class="field-grid">
          <div class="field full"><label>粘贴对标链接</label><input class="control" name="link" placeholder="粘贴抖音/小红书/B站链接，用来识别平台和保存来源" value="https://example.com/video"></div>
          <div class="field"><label>平台</label><select class="control" name="platform"><option>抖音</option><option selected>小红书</option><option>B站</option><option>视频号</option><option>其他</option></select></div>
          <div class="field"><label>我想学习的方向</label><select class="control" name="direction"><option>开头</option><option>节奏</option><option>字幕</option><option>封面</option><option>选题</option><option>结构</option><option>转场</option><option>BGM</option></select></div>
          <div class="field full">
            <label>上传截图</label>
            <div class="upload-zone" data-upload="image">
              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/*">
              <div class="upload-copy"><div class="upload-symbol">＋</div><strong>上传封面/视频截图/评论截图</strong><p>图片只在本地预览，不上传服务器。链接读不到时，用截图继续拆解。</p></div>
              <img class="preview-image" alt="对标截图预览">
            </div>
            <input type="hidden" name="screenshot" value="">
          </div>
          <div class="field full"><label>爆款标题</label><input class="control" name="title" value="剪辑小白第一个月，是怎么接到第一单的？"></div>
          <div class="field full"><label>前 3 秒内容</label><textarea class="control" name="hook">开头展示收款截图，再抛出"剪辑小白如何拿到第一单"的问题。</textarea></div>
          <div class="field full"><label>视频内容描述</label><textarea class="control" name="description">真人口播分享接单经历，中段讲三步方法，结尾引导观众评论自己的阶段。</textarea></div>
          <div class="field"><label>字幕/画面风格</label><input class="control" name="visual" value="短句字幕、关键词放大、收款截图结果前置"></div>
          <div class="field"><label>节奏/BGM感受</label><input class="control" name="rhythm" value="开头快，中段每个方法点停顿清楚，BGM不抢人声"></div>
          <div class="field full"><label>热评/观众问题</label><textarea class="control" name="comments">"没有作品集怎么办？""客户去哪里找？""报价多少比较合适？"</textarea></div>
          <div class="field full"><label>我想迁移到自己作品的动作</label><textarea class="control" name="transfer">结果前置、问题拆分、短句字幕，用自己的真实案例替换原作者经历。</textarea></div>
        </div>
        <div class="form-actions"><span class="form-tip">不下载视频、不承诺读取平台内容；链接只做来源识别，拆解基于截图和你主动填写的信息。</span><button class="primary-button" type="submit">生成AI拆解表</button></div>
      </form>
      ${resultShell("benchmarkResult", "生成AI拆解表")}
    </div>`;

  el("#benchmarkForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const link = data.get("link") || "未填写";
      const platform = data.get("platform");
      const direction = data.get("direction");
      const title = data.get("title") || "未填写";
      const hook = data.get("hook") || "未填写";
      const description = data.get("description") || "未填写";
      const visual = data.get("visual") || "未填写";
      const rhythm = data.get("rhythm") || "未填写";
      const comments = data.get("comments") || "未填写";
      const transfer = data.get("transfer") || "未填写";
      const screenshot = data.get("screenshot") || "未上传截图";

      const aiPrompt = [
        "你是短视频剪辑课助教，请根据我手动补充的信息做对标拆解，不要假设你已经读取了平台原视频。",
        "平台：" + platform, "原链接：" + link, "截图状态：" + screenshot,
        "标题：" + title, "前3秒：" + hook, "内容描述：" + description,
        "字幕/画面风格：" + visual, "节奏/BGM感受：" + rhythm,
        "热评/观众问题：" + comments, "我想迁移的动作：" + transfer,
        "请输出：1. 前3秒钩子拆解；2. 内容结构；3. 字幕/画面/节奏特点；4. 评论区需求；5. 可迁移动作；6. 不建议模仿的地方；7. 我可以做成作品集的样片方案。"
      ].join("\n");

      el("#benchmarkResult").innerHTML = resultLayout("AI拆解表", `${platform} · ${direction}方向 · 基于手动信息`, [
        resultCard("链接识别结果", [`平台：${platform}`, `来源链接：${link}`, `截图：${screenshot}`, "说明：抖音/小红书经常禁止网页自动读取，当前流程不依赖抓取。"], true),
        resultCard("前 3 秒钩子", `根据你填写的信息，开头重点是：${hook}。拆解时先判断它有没有做到结果前置、问题明确、人群清楚。`),
        resultCard("内容结构", [`标题：${title}`, `主体描述：${description}`, "建议按"结果/痛点 → 过程/方法 → 证明/案例 → 互动/转化"四段记录。"]),
        resultCard("字幕 / 画面 / 节奏", [`字幕画面：${visual}`, `节奏BGM：${rhythm}`, "判断重点：字幕是否服务理解、画面是否抢重点、BGM是否影响人声。"]),
        resultCard("评论区未满足需求", comments.split(/[\\n；;]+/).filter(Boolean).slice(0, 6)),
        resultCard("适合学员迁移", transfer, true),
        resultCard("不建议模仿", ["不要复制原作者文案、人设和封面样式", "不要使用虚假收入数据或无法证明的结果", "不要为了像对标而堆转场、音效和花字"]),
        resultCard("可做成作品集的样片", `围绕"${direction}"做一条 30-60 秒样片：先复刻底层结构，再替换成自己的真实素材/案例/服务对象。`),
        resultCard("复制给 AI 的拆解提示词", aiPrompt, true)
      ]);
      saveToHistory("benchmark", "对标拆解助手", `${platform} · ${direction} · ${title}`);
    });
  });
}
