// Vercel Serverless Function - real image vision analysis
// Requires OPENAI_API_KEY in server-side environment variables.

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_DATA_URL_LENGTH = 9 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(501).json({
      ok: false,
      configured: false,
      error: 'vision_not_configured',
      message: '图片识别服务暂未配置。请在 Vercel 服务端环境变量中配置 OPENAI_API_KEY。'
    });
  }

  try {
    const { mode, image } = req.body || {};
    if (!['subtitle', 'font'].includes(mode)) {
      return res.status(400).json({ ok: false, error: 'invalid_mode' });
    }
    if (!image || !image.dataUrl || !image.mime) {
      return res.status(400).json({ ok: false, error: 'missing_image' });
    }
    if (!ALLOWED_MIME.has(image.mime)) {
      return res.status(400).json({ ok: false, error: 'unsupported_image_type' });
    }
    if (String(image.dataUrl).length > MAX_DATA_URL_LENGTH) {
      return res.status(413).json({ ok: false, error: 'image_too_large' });
    }

    const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
    const prompt = mode === 'subtitle' ? subtitlePrompt() : fontPrompt();

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: image.dataUrl }
          ]
        }],
        max_output_tokens: 1800
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        configured: true,
        error: 'vision_api_error',
        message: data?.error?.message || '视觉识别接口调用失败'
      });
    }

    const text = extractOutputText(data);
    const analysis = parseModelJson(text);
    if (!analysis) {
      return res.status(502).json({
        ok: false,
        configured: true,
        error: 'invalid_model_output',
        message: '视觉模型没有返回可解析的结构化结果。'
      });
    }

    return res.status(200).json({
      ok: true,
      configured: true,
      mode,
      model,
      analysis
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      configured: Boolean(process.env.OPENAI_API_KEY),
      error: 'vision_failed',
      message: err.message || '图片识别失败'
    });
  }
}

function subtitlePrompt() {
  return `你是短视频剪辑课助教，需要真实读取用户上传截图中的字幕和画面信息。
不要假装识别成功；如果看不清、没有字幕、无法判断，请明确写在 limitations。
只返回 JSON，不要 Markdown，不要代码块。

请分析：
1. 图片中的字幕文字
2. 字幕位置：顶部 / 中部 / 底部 / 左 / 右 / 其他
3. 字幕行数和断句
4. 字幕颜色
5. 是否有描边、阴影、底色条
6. 字幕和背景的对比度
7. 字幕是否压住人物脸、产品、主体
8. 字幕是否太小、太密、太花
9. 是否存在错别字、标点混乱、断句不舒服
10. 字幕层级是否清楚

JSON 字段：
{
  "recognizedText": ["逐条列出识别到的字幕"],
  "position": "字幕位置判断",
  "lineCount": "行数",
  "lineBreaks": ["断句观察"],
  "colors": ["字幕颜色/背景色观察"],
  "effects": ["描边/阴影/底色条观察"],
  "contrast": "对比度判断",
  "occlusion": "是否遮挡主体",
  "density": "信息密度判断",
  "hierarchy": "主标题/解释字/关键词层级判断",
  "textIssues": ["错别字/标点/断句问题，没有就写未发现明确问题"],
  "currentProblems": ["当前问题"],
  "optimizationSuggestions": ["具体优化建议"],
  "optimizedSubtitle": "可直接复制的优化后字幕",
  "editorJudgment": "从接单交付角度解释为什么这样改更像可交付成片",
  "confidence": "高/中/低",
  "limitations": ["无法确认或看不清的部分"]
}`;
}

function fontPrompt() {
  return `你是短视频剪辑课助教，需要真实分析用户上传截图中的字体风格。
不要假装百分百识别具体字体名称；如果不能确认原字体，请说明只能做相似风格推荐。
不要提供盗版字体文件，不要编造下载链接。只返回 JSON，不要 Markdown，不要代码块。

请分析：
1. 字体类型：黑体 / 宋体 / 手写 / 圆体 / 综艺字 / 美术字 / 毛笔字 / 英文字体等
2. 字重：细 / 常规 / 中粗 / 加粗 / 特粗
3. 字形特征：圆润、锐利、复古、可爱、高级、商业、综艺、手作感等
4. 使用场景
5. 字体层级：主标题、辅助字、强调词是否区分
6. 是否字体混乱、风格不统一、字号层级不清

JSON 字段：
{
  "detectedStyle": "识别到的字体风格",
  "confidenceNote": "置信度说明，必须说明是否能确认具体字体",
  "fontType": "字体类型",
  "weight": "字重",
  "shapeFeatures": ["字形特征"],
  "hierarchy": "字体层级判断",
  "issues": ["字体混乱/风格不统一/字号层级问题，没有就写未发现明显问题"],
  "similarFonts": [
    {"name":"字体名称或方向","style":"风格说明","usage":"适合用途"}
  ],
  "suitableVideos": ["适合视频类型"],
  "optimizationSuggestions": ["针对这张图的字体优化建议"],
  "usageReminder": "商用和版权提醒"
}`;
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function parseModelJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (e) { return null; }
    }
    return null;
  }
}
