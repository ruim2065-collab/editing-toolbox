/* 修改意见整理助手 */
import { el, resultShell, resultCard, simulate, saveToHistory } from "../utils.js";

export function initRevision() {
  el("#view-revision").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="revisionForm">
        <div class="panel-title"><h3>粘贴客户修改意见</h3><span>自动整理</span></div>
        <div class="field-grid">
          <div class="field full"><label>客户修改意见</label><textarea class="control" name="feedback" style="min-height:190px" placeholder="支持粘贴零散聊天记录">开头那个停顿删掉；第 12 秒字幕太小；中间产品特写换成我后面发的素材；结尾电话再放大一点，音乐声音也小一点。</textarea></div>
          <div class="field"><label>视频总时长</label><input class="control" name="duration" value="1 分 10 秒"></div>
          <div class="field"><label>是否需要回复客户</label><div class="choice-row"><label class="choice"><input type="radio" name="reply" value="是" checked><span>是</span></label><label class="choice"><input type="radio" name="reply" value="否"><span>否</span></label></div></div>
        </div>
        <div class="form-actions"><span class="form-tip">整理后仍需核对时间点，避免对客户模糊描述过度推断。</span><button class="primary-button" type="submit">整理修改清单</button></div>
      </form>
      ${resultShell("revisionResult", "整理修改清单")}
    </div>`;

  el("#revisionForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, () => {
      el("#revisionResult").innerHTML = `<div class="result-content">
        <div class="result-hero"><small>整理完成</small><h4>共识别 5 项修改</h4></div>
        <div class="result-table-wrap"><table class="result-table">
          <thead><tr><th>时间点</th><th>修改内容</th><th>类型</th><th>优先级</th><th>二次确认</th></tr></thead>
          <tbody>
            <tr><td>00:00</td><td>删除开头停顿</td><td>节奏</td><td><span class="priority">高</span></td><td>否</td></tr>
            <tr><td>00:12</td><td>放大字幕字号</td><td>字幕</td><td><span class="priority">中</span></td><td>否</td></tr>
            <tr><td>中段</td><td>替换产品特写素材</td><td>素材</td><td><span class="priority">高</span></td><td>是，待客户发素材</td></tr>
            <tr><td>结尾</td><td>放大联系电话</td><td>包装</td><td><span class="priority">中</span></td><td>否</td></tr>
            <tr><td>全片</td><td>降低背景音乐音量</td><td>声音</td><td><span class="priority">中</span></td><td>否</td></tr>
          </tbody>
        </table></div>
        <div class="result-grid" style="margin-top:12px">${resultCard("给客户的回复话术", "收到，本轮共整理出 5 项修改。其中产品特写替换需要您补发对应素材，其余修改我会按清单处理。素材收到后我再同步新的交付时间。", true)}</div>
        <div class="result-toolbar"><button class="secondary-button copy-result" type="button">复制清单</button><button class="export-button export-pdf" type="button">导出 PDF</button></div>
      </div>`;
      saveToHistory("revision", "修改意见整理助手", "共识别 5 项修改");
    });
  });
}
