// Vercel Serverless Function - real image vision analysis.
// Keys must stay in server-side environment variables.

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_DATA_URL_LENGTH = 9 * 1024 * 1024;
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { mode, image } = req.body || {};
    const validation = validateInput(mode, image);
    if (validation) return res.status(validation.status).json(validation.body);

    const provider = selectVisionProvider();
    if (!provider) {
      return res.status(501).json({
        ok: false,
        configured: false,
        error: 'vision_not_configured',
        message: '图片识别服务暂未配置。请在 Vercel 服务端环境变量中配置 GEMINI_API_KEY、VISION_API_KEY 或 OPENAI_API_KEY。'
      });
    }

    const prompt = mode === 'subtitle' ? subtitlePrompt() : fontPrompt();
    const vision = await runVisionProvider(provider, prompt, image);
    if (!vision.ok) {
      return res.status(vision.status || 502).json({
        ok: false,
        configured: true,
        provider: provider.name,
        error: vision.error || 'vision_api_error',
        message: vision.message || '视觉识别接口调用失败'
      });
    }

    const analysis = await maybeRefineWithDeepSeek(mode, vision.analysis);

    return res.status(200).json({
      ok: true,
      configured: true,
      mode,
      provider: provider.name,
      model: provider.model,
      analysis,
      analysisProvider: process.env.DEEPSEEK_API_KEY ? 'deepseek' : provider.name
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      configured: Boolean(selectVisionProvider()),
      error: 'vision_failed',
      message: err.message || '图片识别失败'
    });
  }
}

function validateInput(mode, image) {
  if (!['subtitle', 'font'].includes(mode)) {
    return { status: 400, body: { ok: false, error: 'invalid_mode' } };
  }
  if (!image || !image.dataUrl || !image.mime) {
    return { status: 400, body: { ok: false, error: 'missing_image' } };
  }
  if (!ALLOWED_MIME.has(image.mime)) {
    return { status: 400, body: { ok: false, error: 'unsupported_image_type' } };
  }
  if (String(image.dataUrl).length > MAX_DATA_URL_LENGTH) {
    return { status: 413, body: { ok: false, error: 'image_too_large' } };
  }
  return null;
}

function selectVisionProvider() {
  const requested = (process.env.VISION_PROVIDER || '').toLowerCase();

  if ((requested === 'gemini' || (!requested && process.env.GEMINI_API_KEY)) && process.env.GEMINI_API_KEY) {
    return {
      name: 'gemini',
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_VISION_MODEL || process.env.VISION_MODEL || DEFAULT_GEMINI_MODEL
    };
  }

  if ((requested === 'openai-compatible' || requested === 'compatible' || (!requested && process.env.VISION_API_KEY)) && process.env.VISION_API_KEY) {
    return {
      name: 'openai-compatible',
      apiKey: process.env.VISION_API_KEY,
      baseUrl: stripTrailingSlash(process.env.VISION_API_BASE || 'https://api.openai.com/v1'),
      model: process.env.VISION_MODEL || DEFAULT_OPENAI_MODEL,
      style: (process.env.VISION_API_STYLE || 'chat').toLowerCase()
    };
  }

  if ((requested === 'openai' || (!requested && process.env.OPENAI_API_KEY)) && process.env.OPENAI_API_KEY) {
    return {
      name: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      model: process.env.OPENAI_VISION_MODEL || process.env.VISION_MODEL || DEFAULT_OPENAI_MODEL,
      style: 'responses'
    };
  }

  return null;
}

async function runVisionProvider(provider, prompt, image) {
  if (provider.name === 'gemini') return runGeminiVision(provider, prompt, image);
  if (provider.style === 'responses') return runResponsesVision(provider, prompt, image);
  return runChatVision(provider, prompt, image);
}

async function runGeminiVision(provider, prompt, image) {
  const base64 = String(image.dataUrl).split(',')[1];
  if (!base64) return { ok: false, status: 400, error: 'invalid_image_data', message: '图片数据格式无效' };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: image.mime, data: base64 } },
          { text: prompt }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1800,
        responseMimeType: 'application/json'
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: 'vision_api_error',
      message: data?.error?.message || 'Gemini 视觉接口调用失败'
    };
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n').trim();
  return parseVisionText(text);
}

async function runResponsesVision(provider, prompt, image) {
  const response = await fetch(`${provider.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: provider.model,
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

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: 'vision_api_error',
      message: data?.error?.message || '视觉识别接口调用失败'
    };
  }

  return parseVisionText(extractResponsesText(data));
}

async function runChatVision(provider, prompt, image) {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: image.dataUrl } }
        ]
      }],
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: 'vision_api_error',
      message: data?.error?.message || 'OpenAI 兼容视觉接口调用失败'
    };
  }

  const text = data?.choices?.[0]?.message?.content || '';
  return parseVisionText(text);
}

async function maybeRefineWithDeepSeek(mode, analysis) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return analysis;

  const baseUrl = stripTrailingSlash(process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com');
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: '你是剪辑接单工具箱的结果整理助手。只能基于输入的真实视觉识别结果优化表达，不得新增图片里没有的信息。只返回 JSON，不要 Markdown。'
        },
        {
          role: 'user',
          content: deepSeekPrompt(mode, analysis)
        }
      ],
      temperature: 0.3,
      max_tokens: 1800,
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return analysis;

  const refined = parseModelJson(data?.choices?.[0]?.message?.content || '');
  return refined || analysis;
}

function deepSeekPrompt(mode, analysis) {
  const base = JSON.stringify(analysis || {}, null, 2);
  if (mode === 'subtitle') {
    return `请把下面的截图字幕识别结果整理成同字段 JSON。要求：建议更适合剪辑小白接单交付；不能编造未识别到的文字；保留 recognizedText、position、lineCount、colors、effects、contrast、occlusion、density、hierarchy、textIssues、currentProblems、optimizationSuggestions、optimizedSubtitle、editorJudgment、confidence、limitations 字段。\n\n${base}`;
  }
  return `请把下面的截图字体识别结果整理成同字段 JSON。要求：只推荐相似字体方向，不要假装百分百确认具体字体；不提供字体文件或盗版下载；保留 detectedStyle、confidenceNote、fontType、weight、shapeFeatures、hierarchy、issues、similarFonts、suitableVideos、optimizationSuggestions、usageReminder 字段。\n\n${base}`;
}

function parseVisionText(text) {
  const analysis = parseModelJson(text);
  if (!analysis) {
    return {
      ok: false,
      status: 502,
      error: 'invalid_model_output',
      message: '视觉模型没有返回可解析的结构化结果。'
    };
  }
  return { ok: true, analysis };
}

function subtitlePrompt() {
  return `你是短视频剪辑课助教，必须真实读取用户上传截图中的字幕和画面信息。不要假装识别成功；如果看不清、没有字幕、无法判断，请明确写在 limitations。只返回 JSON，不要 Markdown，不要代码块。
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

返回 JSON 字段：
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
  return `你是短视频剪辑课助教，必须真实分析用户上传截图中的字体风格。不要假装百分百识别出具体字体名称；如果不能确认原字体，请说明只能做相似风格推荐。不要提供盗版字体文件，不要编造下载链接。只返回 JSON，不要 Markdown，不要代码块。
请分析：
1. 字体类型：黑体 / 宋体 / 手写 / 圆体 / 综艺字 / 美术字 / 毛笔字 / 英文字体等
2. 字重：细 / 常规 / 中粗 / 加粗 / 特粗
3. 字形特征：圆润、锐利、复古、可爱、高级、商业、综艺、手作感等
4. 使用场景
5. 字体层级：主标题、辅助字、强调词是否区分
6. 是否字体混乱、风格不统一、字号层级不清

返回 JSON 字段：
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

function extractResponsesText(data) {
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
  const cleaned = String(text).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
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

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}
