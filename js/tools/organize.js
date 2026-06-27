/* 素材库整理助手 */
import { el, choice, resultShell, resultCard, resultLayout, simulate, saveToHistory } from "../utils.js";

export function initOrganize() {
  el("#view-organize").innerHTML = `
    <div class="tool-layout">
      <form class="form-panel surface" id="organizeForm">
        <div class="panel-title"><h3>选择你的素材类型</h3><span>自动整理方案</span></div>
        <div class="field-grid">
          <div class="field full"><label>你常做的视频类型</label><select class="control" name="videotype"><option>口播/知识</option><option>vlog/生活</option><option>探店/美食</option><option>带货/种草</option><option>多类型都做</option></select></div>
          <div class="field"><label>素材存储位置</label><select class="control" name="location"><option>电脑本地硬盘</option><option>移动硬盘</option><option>NAS/云盘</option><option>混合存储</option></select></div>
          <div class="field"><label>需要整理的素材</label>${choice("materials", ["视频素材+音乐+音效+图片+模板", "只要视频素材"], 0)}</div>
          <div class="field"><label>项目命名偏好</label><select class="control" name="naming"><option>日期-客户名-项目名</option><option>客户名-项目名-版本号</option><option>项目编号-日期-类型</option></select></div>
          <div class="field full"><label>📎 粘贴素材/资源链接（可选）</label><input class="control" name="link" placeholder="贴素材链接、网盘链接或资源页面，帮你分类整理"></div>
          <div class="field"><label>是否需要备份方案</label>${choice("backup", ["是，需要", "否，暂不需要"])}</div>
        </div>
        <div class="form-actions"><span class="form-tip">文件夹结构建议基于实际剪辑工作流，可复制到本地直接使用。</span><button class="primary-button" type="submit">生成整理方案</button></div>
      </form>
      ${resultShell("organizeResult", "生成整理方案")}
    </div>`;

  el("#organizeForm").addEventListener("submit", event => {
    event.preventDefault();
    simulate(event.currentTarget, event.submitter, data => {
      const naming = data.get("naming");
      const needBackup = data.get("backup");
      const location = data.get("location");
      const link = data.get("link") || "";
      const materials = data.get("materials");
      const isFull = materials && materials.includes("+");
      const scheme = naming === "日期-客户名-项目名" ? "20260626_客户名_项目名"
        : naming === "客户名-项目名-版本号" ? "客户名_项目名_v1"
        : "001_20260626_口播";
      const locLabel = location.indexOf("移动") !== -1 ? "移动硬盘" : "电脑";

      const cards = [
        resultCard("根目录结构", "剪辑项目/\n  |-- 01_进行中/     正在做的项目\n  |-- 02_已交付/     完成归档\n  |-- 03_素材库/     通用素材\n  |-- 04_模板/       常用预设\n  |-- 05_音乐音效/   BGM和SFX\n  |-- 06_作品集导出/ 最终成片", true),
        resultCard("单项目文件夹 (" + scheme + ")", scheme + "/\n  |-- 01_客户原始素材/  不动原片\n  |-- 02_筛选后素材/\n  |-- 03_参考对标/\n  |-- 04_项目文件/      剪映工程\n  |-- 05_导出/          各版成片\n  |-- 06_交付文档/      报价/变更/说明\n  |-- README.txt        项目笔记", true),
        isFull ? resultCard("素材库分类", "03_素材库/\n  |-- 视频素材/（空镜/转场/特效）\n  |-- 图片素材/（背景/贴纸/封面模板）\n  |-- 音乐BGM/（治愈/励志/情绪）\n  |-- 音效SFX/（转场/提示音/氛围）", true) : "",
        resultCard("命名规范", ["项目：" + scheme, "成片：" + scheme + "_成片_日期.mp4", "修改版：" + scheme + "_V2_修改说明.mp4", "素材保持原名（方便回溯）", "不用空格用下划线，日期YYYYMMDD"], true),
        needBackup === "是，需要" ? resultCard("备份方案", ["每周五备份到" + locLabel, "重要项目交付后立即备份", "云盘只同步05_导出和06_交付文档", "3个月前项目移到02_已交付/年份/归档"]) : "",
        resultCard("马上可以做", ["1. 在" + locLabel + "上建好根目录", "2. 把现有素材拖入对应文件夹", "3. 正在做的项目按模板创建", "4. 以后每个新项目都按这个结构", "养成习惯 > 找工具 -- 这个结构够用一年"]),
        resultCard("📎 链接素材整理", link ? "你贴了素材链接。建议按来源分类：在03_素材库下新建一个文件夹用链接来源命名，把从该链接下载的素材统一放进去。链接本身保存到README.txt的素材来源记录里，方便以后回溯。" : "没贴链接。下次可以贴素材链接、网盘链接或资源页面，帮你规划素材分类和存放位置。")
      ];

      el("#organizeResult").innerHTML = resultLayout("文件夹结构方案", naming, cards.filter(Boolean));
      saveToHistory("organize", "素材库整理", naming);
    });
  });
}
