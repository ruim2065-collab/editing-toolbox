// Vercel Serverless Function - real image vision analysis.
// Keys must stay in server-side environment variables.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_DATA_URL_LENGTH = 9 * 1024 * 1024;
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const MANUAL_FONT_IMAGE_ALIASES = new Map([
  ['d570ef763cdb61595607dd29c7c50c36e74aa01d78c0a96584c306cdf6d8234b', {
    id: 'manual-font-sea-island-forest-gold-summer',
    source: '人工校准',
    fileName: 'summer-crop-confirmed-by-user.png',
    relativePath: 'manual/summer-crop-confirmed-by-user.png',
    width: 438,
    height: 222,
    visibleFontName: '海岛森林金字符',
    ocrStatus: 'manual-confirmed',
    styleTags: '英文手写 / 细线 / 度假感 / 自然随性',
    jianyingSearchKeywords: '海岛森林金字符/海岛森林/手写/英文',
    usageNotes: '适合夏日、旅行、海岛、vlog、生活方式类视频标题或点缀字。'
  }]
]);

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

    const knowledgeMatch = findFontKnowledgeMatch(image);
    if (knowledgeMatch?.visibleFontName) {
      const analysis = normalizeFontAnalysis(buildKnowledgeOnlyAnalysis(knowledgeMatch), knowledgeMatch);
      return res.status(200).json({
        ok: true,
        configured: Boolean(selectVisionProvider()),
        mode,
        provider: 'font-knowledge-base',
        model: 'local-index',
        analysis,
        knowledgeMatch: toPublicKnowledgeMatch(knowledgeMatch),
        analysisProvider: 'font-knowledge-base'
      });
    }

    const provider = selectVisionProvider();
    if (!provider) {
      return res.status(501).json({
        ok: false,
        configured: false,
        error: 'vision_not_configured',
        message: '图片识别服务暂未配置。请在 Vercel 服务端环境变量中配置 GEMINI_API_KEY、VISION_API_KEY 或 OPENAI_API_KEY。'
      });
    }

    const isLabelOnly = Boolean(image.labelOnly);
    const prompt = isLabelOnly ? fontLabelPrompt(knowledgeMatch) : fontPrompt(knowledgeMatch);
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

    const refinedAnalysis = isLabelOnly ? vision.analysis : await maybeRefineWithDeepSeek(vision.analysis);
    const analysis = isLabelOnly
      ? normalizeLabelAnalysis(refinedAnalysis, knowledgeMatch)
      : normalizeFontAnalysis(refinedAnalysis, knowledgeMatch);

    return res.status(200).json({
      ok: true,
      configured: true,
      mode,
      provider: provider.name,
      model: provider.model,
      analysis,
      knowledgeMatch: knowledgeMatch ? toPublicKnowledgeMatch(knowledgeMatch) : null,
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

let fontKnowledgeCache = null;
let fontVisualSignatureCache = null;

function loadFontKnowledgeIndex() {
  if (fontKnowledgeCache) return fontKnowledgeCache;
  try {
    const indexPath = path.join(process.cwd(), 'api', 'data', 'font-screenshot-index.json');
    const raw = fs.readFileSync(indexPath, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    const bySha256 = new Map();
    for (const item of data.items || []) {
      if (item?.sha256) bySha256.set(String(item.sha256).toLowerCase(), item);
    }
    fontKnowledgeCache = {
      version: data.version,
      total: data.total || bySha256.size,
      sources: data.sources || [],
      items: data.items || [],
      bySha256
    };
  } catch (err) {
    fontKnowledgeCache = { version: null, total: 0, sources: [], items: [], bySha256: new Map() };
  }
  return fontKnowledgeCache;
}

function loadFontVisualSignatures() {
  if (fontVisualSignatureCache) return fontVisualSignatureCache;
  try {
    const signaturePath = path.join(process.cwd(), 'api', 'data', 'font-visual-signatures.json');
    const raw = fs.readFileSync(signaturePath, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    fontVisualSignatureCache = {
      version: data.version,
      method: data.method,
      items: data.items || []
    };
  } catch (err) {
    fontVisualSignatureCache = { version: null, method: null, items: [] };
  }
  return fontVisualSignatureCache;
}

function findFontKnowledgeMatch(image) {
  const base64 = String(image?.dataUrl || '').split(',')[1];
  if (!base64) return null;
  try {
    const buffer = Buffer.from(base64, 'base64');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const manualAlias = MANUAL_FONT_IMAGE_ALIASES.get(sha256);
    if (manualAlias) {
      const index = loadFontKnowledgeIndex();
      return { ...manualAlias, sha256, indexVersion: index.version, indexTotal: index.total, matchType: 'manual-sha256-confirmed' };
    }
    const index = loadFontKnowledgeIndex();
    const item = index.bySha256.get(sha256);
    if (item) return { ...item, indexVersion: index.version, indexTotal: index.total, matchType: 'sha256-exact' };

    const visualMatch = findFontVisualSignatureMatch(image, index);
    if (visualMatch) return visualMatch;
    return null;
  } catch (err) {
    return null;
  }
}

function findFontVisualSignatureMatch(image, index) {
  const querySignatures = ensureArray(image?.visualSignatures)
    .map(item => typeof item === 'string' ? item : item?.hex)
    .filter(isValidSignatureHex);
  if (!querySignatures.length) return null;

  const visualIndex = loadFontVisualSignatures();
  const byId = new Map((index.items || []).map(item => [item.id, item]));
  let best = null;

  for (const entry of visualIndex.items || []) {
    const item = byId.get(entry.id);
    if (!item?.visibleFontName) continue;
    for (const candidate of entry.signatures || []) {
      if (!isValidSignatureHex(candidate?.hex)) continue;
      for (const queryHex of querySignatures) {
        const distance = normalizedHexHammingDistance(queryHex, candidate.hex);
        if (distance == null) continue;
        if (!best || distance < best.distance) {
          best = { item, distance, crop: candidate.crop, visualIndex };
        }
      }
    }
  }

  // Keep this conservative: a weak visual match should remain a recommendation, not a claimed exact font.
  if (!best || best.distance > 0.18) return null;
  return {
    ...best.item,
    indexVersion: index.version,
    indexTotal: index.total,
    matchType: 'visual-signature-strong',
    visualScore: Number((1 - best.distance).toFixed(4)),
    visualSignatureVersion: best.visualIndex.version,
    matchedCrop: best.crop
  };
}

function isValidSignatureHex(value) {
  return typeof value === 'string' && /^[0-9a-f]+$/i.test(value) && value.length >= 128;
}

function normalizedHexHammingDistance(a, b) {
  if (!isValidSignatureHex(a) || !isValidSignatureHex(b) || a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff += HEX_BIT_COUNTS[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  }
  return diff / (a.length * 4);
}

const HEX_BIT_COUNTS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

function toPublicKnowledgeMatch(match) {
  return {
    id: match.id,
    source: match.source,
    fileName: match.fileName,
    relativePath: match.relativePath,
    width: match.width,
    height: match.height,
    visibleFontName: match.visibleFontName || '',
    ocrStatus: match.ocrStatus || 'pending',
    matchType: match.matchType || 'sha256-exact',
    visualScore: match.visualScore || null
  };
}

function buildKnowledgeOnlyAnalysis(match) {
  return {
    detectedStyle: `已命中自建字体库：${match.visibleFontName}`,
    visibleFontName: match.visibleFontName,
    confidenceNote: match.matchType === 'visual-signature-strong'
      ? `已通过裁剪图字形指纹强匹配到自建字体库，匹配度约 ${Math.round((match.visualScore || 0) * 100)}%。`
      : '该图片与自建剪映/Capcut字体截图库 SHA256 精确匹配，优先使用已入库字体名。',
    fontType: match.styleTags || '已入库字体',
    weight: '',
    shapeFeatures: ['来自自建字体截图库的精确匹配结果'],
    hierarchy: '该结果基于字体库原图匹配，不判断复杂排版层级。',
    issues: ['未发现需要额外修正的问题'],
    jianyingSearchKeywords: match.jianyingSearchKeywords
      ? String(match.jianyingSearchKeywords).split('/').map(keyword => ({ keyword: keyword.trim(), reason: '来自已入库字体搜索词', usage: match.usageNotes || '在剪映/Capcut 字体列表中搜索或查找相近方向' })).filter(item => item.keyword)
      : [{ keyword: match.visibleFontName, reason: '已入库字体名', usage: '优先在对应来源字体库中查找' }],
    similarFonts: [{ name: match.visibleFontName, style: `自建字体库精确命中：${match.source} / ${match.id}`, usage: match.usageNotes || '优先使用该字体或同风格替代字体' }],
    suitableVideos: match.usageNotes ? [match.usageNotes] : ['按该字体原风格使用'],
    optimizationSuggestions: ['如果剪映/Capcut 当前版本搜不到该字体，使用“类似字体 / 替代方向”中的同风格字体。'],
    capcutActionSteps: [
      '打开剪映/Capcut：文字 → 字体',
      `优先查找：${match.visibleFontName}`,
      '如果找不到，按结果里的剪映搜索词或类似方向继续尝试'
    ],
    usageReminder: '字体库可能随剪映/Capcut版本变化，商用前仍需确认授权。',
    limitations: [match.matchType === 'visual-signature-strong' ? '该结果来自裁剪图字形指纹强匹配；如果画面中文字太少、被压缩或只露出局部，仍建议人工复核。' : '该结果只对当前上传图片的原图精确匹配负责；裁剪或压缩后的截图仍需视觉识别辅助。'],
    uploadAdvice: ['上传原始字体截图可获得最高置信度；上传成片截图时建议裁剪到文字区域。'],
    knowledgeBaseMatches: [toPublicKnowledgeMatch(match)]
  };
}

function validateInput(mode, image) {
  if (mode !== 'font') {
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
        maxOutputTokens: 900,
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
      max_output_tokens: 900
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
      max_tokens: 900,
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

async function maybeRefineWithDeepSeek(analysis) {
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
          content: deepSeekPrompt(analysis)
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

function normalizeFontAnalysis(analysis, knowledgeMatch = null) {
  if (!analysis || typeof analysis !== 'object') return analysis;

  const hasConfirmedKnowledgeMatch = Boolean(knowledgeMatch?.visibleFontName);
  const confidencePrefix = '无法百分百确认原字体，以下为相似风格推荐。';
  const currentNote = String(analysis.confidenceNote || '').trim();
  if (hasConfirmedKnowledgeMatch) {
    analysis.confidenceNote = currentNote || '已命中自建字体知识库，优先显示已确认的具体字体名。';
  } else if (!currentNote.includes('无法百分百确认')) {
    analysis.confidenceNote = currentNote ? `${confidencePrefix}${currentNote}` : confidencePrefix;
  }

  analysis.limitations = ensureArray(analysis.limitations);
  if (!hasConfirmedKnowledgeMatch && !analysis.limitations.some(item => String(item).includes('精确字体'))) {
    analysis.limitations.unshift('截图只能判断相似风格和字形特征，不能保证精确字体名。');
  }
  if (!analysis.limitations.some(item => String(item).includes('剪映'))) {
    analysis.limitations.push('视觉模型给出的通用字体名不一定是剪映内置字体，实际使用请优先按“剪映搜索词”查找。');
  }

  analysis.uploadAdvice = ensureArray(analysis.uploadAdvice);
  if (!analysis.uploadAdvice.length) {
    analysis.uploadAdvice = [
      '尽量裁剪到文字区域，保留完整字形。',
      '上传更高清的原图或视频截图，避免聊天软件压缩。',
      '如果有主标题、辅助字、强调词，分别截清楚。'
    ];
  }

  const keywords = hasConfirmedKnowledgeMatch
    ? buildConfirmedFontKeywords(knowledgeMatch, analysis)
    : buildJianyingKeywords(analysis);
  analysis.jianyingSearchKeywords = keywords;

  analysis.knowledgeBaseMatches = ensureArray(analysis.knowledgeBaseMatches);
  if (knowledgeMatch) {
    const publicMatch = toPublicKnowledgeMatch(knowledgeMatch);
    analysis.knowledgeBaseMatches = analysis.knowledgeBaseMatches.filter(item => {
      if (!item || typeof item !== 'object') return true;
      return item.id !== publicMatch.id;
    });
    analysis.knowledgeBaseMatches.unshift(publicMatch);
    if (publicMatch.visibleFontName && !String(analysis.visibleFontName || '').trim()) {
      analysis.visibleFontName = publicMatch.visibleFontName;
    }
    if (!analysis.confidenceNote.includes('已命中自建字体截图知识库')) {
      analysis.confidenceNote += ` 已命中自建字体截图知识库：${publicMatch.source} / ${publicMatch.id}。`;
    }
    if (!analysis.limitations.some(item => String(item).includes('OCR'))) {
      analysis.limitations.push('当前知识库索引已记录截图来源和哈希；批量字体名 OCR 仍待补充，能否读出具体字体名取决于上传图中文字是否清晰。');
    }
  }

  const knownCandidates = findKnownFontCandidates(analysis, knowledgeMatch);

  if (Array.isArray(analysis.similarFonts)) {
    analysis.similarFonts = analysis.similarFonts.map((item, index) => {
      if (!item || typeof item !== 'object') return item;
      if (hasConfirmedKnowledgeMatch) return item;
      const keyword = keywords[index] || keywords[0] || { keyword: '黑体', reason: '剪映内更容易搜索到的基础方向' };
      return {
        ...item,
        name: keyword.keyword,
        style: item.style || keyword.reason,
        usage: item.usage || keyword.usage || '在剪映字体里按关键词搜索相近方向'
      };
    });
  } else {
    analysis.similarFonts = keywords.map(item => ({ name: item.keyword, style: item.reason, usage: item.usage }));
  }
  if (hasConfirmedKnowledgeMatch) {
    const exactFont = {
      name: knowledgeMatch.visibleFontName,
      style: `已命中自建字体库：${knowledgeMatch.source} / ${knowledgeMatch.id}`,
      usage: knowledgeMatch.usageNotes || '优先使用这个准确字体；找不到时再看下面的相似方向。'
    };
    analysis.similarFonts = ensureArray(analysis.similarFonts).filter(item => String(item?.name || item) !== exactFont.name);
    analysis.similarFonts.unshift(exactFont);
  }

  const candidateFirst = !String(analysis.visibleFontName || '').trim() || String(analysis.visibleFontName || '').trim() === '不确定';
  const existingSimilar = ensureArray(analysis.similarFonts);
  analysis.similarFonts = candidateFirst ? [] : existingSimilar;
  for (const candidate of knownCandidates) {
    if (!analysis.similarFonts.some(item => String(item?.name || '').toLowerCase() === candidate.name.toLowerCase())) {
      analysis.similarFonts.push(candidate);
    }
  }
  if (candidateFirst) {
    for (const item of existingSimilar) {
      if (!analysis.similarFonts.some(entry => String(entry?.name || '').toLowerCase() === String(item?.name || '').toLowerCase())) {
        analysis.similarFonts.push(item);
      }
    }
    const primaryCandidate = analysis.similarFonts.find(item => item?.name && !['手写', '圆体', '粗黑', '黑体', '综艺', '宋体', '毛笔', '英文', '简黑'].includes(String(item.name)));
    if (primaryCandidate?.name) {
      analysis.visibleFontName = primaryCandidate.name;
      const note = '未命中原始截图哈希，主字体名为自建字体库字形相似匹配结果。';
      analysis.confidenceNote = analysis.confidenceNote ? `${note}${analysis.confidenceNote}` : note;
      analysis.detectedStyle = analysis.detectedStyle || `最可能字体：${primaryCandidate.name}`;
    }
  }

  analysis.usageReminder = analysis.usageReminder || '不提供字体文件；剪映字体可能随版本变化，优先用搜索词找相似方向，商用前确认授权。';
  return analysis;
}

function buildConfirmedFontKeywords(match, analysis) {
  const keywords = [];
  const add = (keyword, reason, usage) => {
    const clean = String(keyword || '').trim();
    if (clean && !keywords.some(item => item.keyword === clean)) keywords.push({ keyword: clean, reason, usage });
  };
  add(match.visibleFontName, '已确认的具体字体名，优先在剪映/Capcut 字体列表里直接搜这个名字。', match.usageNotes || '优先使用准确字体。');
  String(match.jianyingSearchKeywords || '')
    .split('/')
    .map(item => item.trim())
    .filter(Boolean)
    .forEach(item => add(item, '来自已入库字体搜索词。', match.usageNotes || '用于找同款或相近字体。'));
  for (const item of buildJianyingKeywords(analysis)) {
    add(item.keyword, item.reason, item.usage);
  }
  return keywords.slice(0, 6);
}

function normalizeLabelAnalysis(analysis, knowledgeMatch = null) {
  const result = analysis && typeof analysis === 'object' ? analysis : {};
  result.detectedStyle = result.detectedStyle || '标签OCR';
  result.visibleFontName = String(result.visibleFontName || '').trim() || '不确定';
  result.confidenceNote = result.confidenceNote || '该结果来自字体截图上方名称标签的裁剪OCR。';
  result.fontType = result.fontType || '标签OCR';
  result.weight = result.weight || '';
  result.shapeFeatures = ensureArray(result.shapeFeatures);
  result.hierarchy = result.hierarchy || '只识别字体名称标签，忽略展示文案。';
  result.issues = ensureArray(result.issues);
  result.jianyingSearchKeywords = ensureArray(result.jianyingSearchKeywords);
  result.similarFonts = ensureArray(result.similarFonts);
  result.suitableVideos = ensureArray(result.suitableVideos);
  result.optimizationSuggestions = ensureArray(result.optimizationSuggestions);
  result.capcutActionSteps = ensureArray(result.capcutActionSteps);
  result.usageReminder = result.usageReminder || '该结果来自截图标签OCR，不提供字体文件。';
  result.limitations = ensureArray(result.limitations);
  result.uploadAdvice = ensureArray(result.uploadAdvice);
  result.knowledgeBaseMatches = ensureArray(result.knowledgeBaseMatches);
  if (knowledgeMatch) result.knowledgeBaseMatches.unshift(toPublicKnowledgeMatch(knowledgeMatch));
  return result;
}

function findKnownFontCandidates(analysis, knowledgeMatch = null) {
  const index = loadFontKnowledgeIndex();
  const text = [
    analysis.detectedStyle,
    analysis.fontType,
    analysis.weight,
    ...(Array.isArray(analysis.shapeFeatures) ? analysis.shapeFeatures : []),
    ...(Array.isArray(analysis.suitableVideos) ? analysis.suitableVideos : []),
    ...(Array.isArray(analysis.jianyingSearchKeywords) ? analysis.jianyingSearchKeywords.map(item => item?.keyword || item) : [])
  ].filter(Boolean).join(' ').toLowerCase();

  const namedItems = (index.items || []).filter(item => item.visibleFontName);
  const scored = namedItems.map(item => {
    const haystack = [
      item.visibleFontName,
      item.source,
      item.styleTags,
      item.jianyingSearchKeywords,
      item.usageNotes
    ].filter(Boolean).join(' ').toLowerCase();
    let score = 0;
    for (const token of ['手写', '英文', '粗黑', '黑体', '圆体', '综艺', '宋体', '毛笔', '像素', '复古', 'graffiti', 'mono', 'serif', 'brush', 'pixel']) {
      if (text.includes(token) && haystack.includes(token)) score += 3;
    }
    if (/手写|handwritten|handwriting|自然|随性|细线|轻松|vlog/.test(text)) {
      if (/海岛森林/.test(item.visibleFontName)) score += 12;
      if (/心晴手写|老猫手写|剪映糯米|一见青心|悠悠然/.test(item.visibleFontName)) score += 5;
      if (/手写/.test(haystack)) score += 2;
      if (/粗黑|特粗|加粗/.test(haystack)) score -= 2;
    }
    if (knowledgeMatch && item.id === knowledgeMatch.id) score += 6;
    if (item.source === knowledgeMatch?.source) score += 1;
    if (/英文|english|latin/.test(text) && /^[a-z0-9 ._-]+$/i.test(item.visibleFontName)) score += 1;
    return { item, score };
  }).filter(entry => entry.score > 0);

  scored.sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)));
  return scored.slice(0, 5).map(({ item }) => ({
    name: item.visibleFontName,
    style: `来自自建字体库：${item.source} / ${item.id}`,
    usage: item.usageNotes || item.jianyingSearchKeywords || '可在剪映/Capcut 字体列表中优先尝试'
  }));
}

function buildJianyingKeywords(analysis) {
  const text = [
    analysis.detectedStyle,
    analysis.fontType,
    analysis.weight,
    ...(Array.isArray(analysis.shapeFeatures) ? analysis.shapeFeatures : []),
    ...(Array.isArray(analysis.suitableVideos) ? analysis.suitableVideos : [])
  ].filter(Boolean).join(' ').toLowerCase();

  const picks = [];
  const add = (keyword, reason, usage) => {
    if (!picks.some(item => item.keyword === keyword)) picks.push({ keyword, reason, usage });
  };

  if (/手写|手作|可爱|圆润|亲和|生活|探店|vlog/.test(text)) {
    add('手写', '偏手写/手作感时，剪映里先搜“手写”。', '生活、探店、vlog、朋友圈感封面');
    add('圆体', '圆润亲和的字形，剪映里可搜“圆体”。', '探店、生活、美妆、轻松口播');
  }
  if (/综艺|花字|夸张|粗|特粗|impact|arial black|标题|封面/.test(text)) {
    add('粗黑', '粗标题和强视觉冲击，剪映里先搜“粗黑”。', '封面标题、综艺感花字、重点强调');
    add('综艺', '有网感/综艺包装时，剪映里搜“综艺”。', '搞笑、种草、强情绪标题');
  }
  if (/黑体|无衬线|sans|商业|知识|口播|清晰|简洁|现代/.test(text)) {
    add('黑体', '清晰无衬线方向，剪映里先搜“黑体”。', '知识口播、字幕、课程切片');
    add('简黑', '更干净克制的黑体方向，剪映里可搜“简黑”。', '知识号、作品集、商业案例');
  }
  if (/宋体|衬线|复古|高级|文艺/.test(text)) {
    add('宋体', '有衬线/复古/文艺感时，剪映里先搜“宋体”。', '文艺、情绪、书单、复古封面');
  }
  if (/毛笔|书法|国风|水墨/.test(text)) {
    add('毛笔', '书法和国风方向，剪映里先搜“毛笔”。', '国风、情绪、传统文化类视频');
  }
  if (/英文|english|latin|arial|impact|portfolio/.test(text)) {
    add('英文', '截图主文字偏英文时，剪映里搜“英文”找相近英文字体。', '作品集封面、英文标题、潮流包装');
  }

  if (!picks.length) {
    add('黑体', '无法稳定判断具体字体时，先用剪映里最容易找到的清晰黑体方向。', '字幕和口播最稳');
    add('粗黑', '如果是封面标题，可再试粗黑方向。', '封面标题和关键词强调');
    add('圆体', '如果想更亲和，可试圆体方向。', '生活、探店、美妆');
  }

  return picks.slice(0, 5);
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [String(value)];
}

function deepSeekPrompt(analysis) {
  const base = JSON.stringify(analysis || {}, null, 2);
  return `请把下面的截图字体识别结果整理成同字段 JSON。要求：只做字体风格诊断和相似方向推荐，不要猜测精确字体名；如果截图里明确显示字体名称，必须保留 visibleFontName，但不要把它强行改成剪映搜索词；如果不能百分百确定原字体，也必须在 similarFonts 给出 2-5 个类似字体/替代方向，优先使用剪映可搜索词或截图中可见的相似字体名，并说明为什么像。若输入结果里有具体字体名但证据不足，要改写为“相似方向”。不提供字体文件或盗版下载；保留 detectedStyle、visibleFontName、confidenceNote、fontType、weight、shapeFeatures、hierarchy、issues、jianyingSearchKeywords、similarFonts、suitableVideos、optimizationSuggestions、capcutActionSteps、usageReminder、limitations、uploadAdvice、knowledgeBaseMatches 字段；similarFonts 必须给出可执行替代方向，不要只写“无法确认”。\n\n${base}`;
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

function fontPrompt(knowledgeMatch = null) {
  const knowledgeNote = knowledgeMatch
    ? `\n\n自建字体截图知识库命中：\n- 匹配方式：图片 SHA256 精确匹配\n- 知识库编号：${knowledgeMatch.id}\n- 来源：${knowledgeMatch.source}\n- 已入库字体名：${knowledgeMatch.visibleFontName || '暂未入库'}\n- 原文件名：${knowledgeMatch.fileName}\n- 截图尺寸：${knowledgeMatch.width || '未知'}x${knowledgeMatch.height || '未知'}\n如果“已入库字体名”不是“暂未入库”，必须优先把它写入 visibleFontName。这类图片是用户从剪映 / Capcut 字体列表截下来的字体预览图，画面上通常有一个较小的字体名称，常见位置在预览文字上方、旁边或列表项标题处。请优先读取这个字体名称并写入 visibleFontName，例如看到 “Asma” 就必须写 “Asma”。如果确实看不清，再写“不确定”。请在返回结果的 knowledgeBaseMatches 里保留这条命中。`
    : '';
  return `你是短视频剪辑课助教，任务不是识别精确字体文件名，而是基于截图做可靠的“字体风格诊断”，并给出剪映里能实际搜索的关键词。必须真实观察图片中的文字形态；不要假装百分百识别出具体字体名称。${knowledgeNote}

重要规则：
- 不要输出 Arial、Impact、思源黑体、阿里巴巴普惠体等学生不一定能在剪映里搜到的字体名作为主推荐。
- 如果需要描述相似字体，只能作为“风格参考”，不能让学生去剪映里搜这些名字。
- 必须给出 jianyingSearchKeywords：剪映里建议搜索的中文关键词，例如：黑体、粗黑、圆体、手写、综艺、宋体、毛笔、英文、简黑、可爱、标题等。
- 如果截图是字体库预览图，并且画面上明确写着字体名称，必须在 visibleFontName 字段读出这个名字；这个名字可以是英文、中文或符号组合。
- visibleFontName 是“截图上看见的字体名”，jianyingSearchKeywords 是“剪映里可尝试搜索的方向词”，二者不要混淆。
- 如果不能百分百确定原字体，也必须给出 2-5 个类似字体/替代方向，写入 similarFonts；不要只说“不确定”。
- 如果不能确认，明确写“无法百分百确认原字体，以下为剪映内相似搜索方向”。
- 不提供字体文件或盗版下载链接。

先判断图片是否适合识别：
- 如果文字太小、模糊、被压缩、只露出一两个字、背景干扰很强，要降低 confidence，并在 limitations 和 uploadAdvice 里说明。
- 如果有多个字体，请分别判断主标题、辅助字、强调词，不要混成一个结论。
- 如果只是普通系统黑体/无衬线，也要直接说“偏通用黑体/无衬线方向”，并推荐剪映搜索词“黑体/简黑/粗黑”。

请分析：
0. 截图上是否有明确字体名称：优先看预览字上方/旁边的小字、字体列表项标题、已选字体名称。
1. 字体类型：黑体 / 宋体 / 手写 / 圆体 / 综艺字 / 美术字 / 毛笔字 / 英文字体 / 通用无衬线等
2. 字重：细 / 常规 / 中粗 / 加粗 / 特粗
3. 字形特征：笔画端点、转角、字腔、宽窄、重心、圆润/锐利/复古/可爱/商业/综艺/手作感
4. 使用场景：口播字幕、封面标题、探店、美妆、知识号、综艺包装等
5. 字体层级：主标题、辅助字、强调词是否区分
6. 是否字体混乱、风格不统一、字号层级不清

返回 JSON 字段：
{
  "detectedStyle": "识别到的字体风格，用风格描述，不写精确字体断言",
  "visibleFontName": "如果截图里明确显示字体名称，在这里写出；看不清或没有就写“不确定”",
  "confidenceNote": "置信度说明，必须写清：无法百分百确认原字体，以下为剪映内相似搜索方向；如果画面不清楚要说明原因",
  "fontType": "字体类型",
  "weight": "字重",
  "shapeFeatures": ["具体字形特征，例如笔画粗细、转角、字腔、重心、端点"],
  "hierarchy": "字体层级判断",
  "issues": ["字体混乱/风格不统一/字号层级问题，没有就写未发现明显问题"],
  "jianyingSearchKeywords": [
    {"keyword":"剪映里建议搜索的关键词","reason":"为什么搜这个词","usage":"适合用途"}
  ],
  "similarFonts": [
    {"name":"类似字体或剪映替代搜索词","style":"为什么相似，例如同样是手写/粗黑/圆体/衬线/复古方向","usage":"适合用途"}
  ],
  "suitableVideos": ["适合视频类型"],
  "optimizationSuggestions": ["针对这张图的字体优化建议"],
  "capcutActionSteps": ["剪映里下一步怎么操作：先搜什么词、找不到搜什么、主标题和辅助字怎么搭配"],
  "usageReminder": "商用和版权提醒，说明剪映字体可能随版本变化，优先按搜索词找相似方向",
  "limitations": ["看不清或无法确认的部分"],
  "uploadAdvice": ["如果识别不准，下一次应如何截图：裁剪文字区域、提高分辨率、避免压缩、保留完整字形等"],
  "knowledgeBaseMatches": [{"id":"知识库编号","source":"剪映/Capcut","fileName":"命中的截图文件名","matchType":"sha256-exact"}]
}`;
}

function fontLabelPrompt(knowledgeMatch = null) {
  const knowledgeNote = knowledgeMatch
    ? `\n\n自建字体截图知识库命中：${knowledgeMatch.source} / ${knowledgeMatch.id}。`
    : '';
  return `你只做 OCR 抄写，不做字体风格判断。图片来自剪映/Capcut字体截图的“字体名称标签”裁剪放大图；裁剪后字体名可能位于画面中间，不一定还在最上方。最清楚、最完整的一行文字通常就是字体名称；底部如果只露出一部分大字，通常只是展示文案，必须忽略。${knowledgeNote}

识别规则：
- 读取画面里最清楚、最完整的那一行名称标签，把它原样写入 visibleFontName。
- 不要把“开箱vlog”“UNBOXING VLOG”“Hello”“标题”等下方展示文案当成字体名称。
- 像 “Monster Energy”“Collage”“奥德赛” 这类清楚可见的名称，必须直接抄写，不要因为它像英文词、商标或中文词就写“不确定”。
- 像 “Love”“Diary”“Writing”“BANGERS” 这类看起来像普通英文单词的清楚文字，在这个任务里也就是字体名称，必须直接写入 visibleFontName。
- 如果小字是中文、英文、数字、符号组合，都要原样保留。
- 如果能看出 1-2 个可能结果，优先写最像的结果；不要因为不是百分百就直接写“不确定”。
- 只有完全看不清或没有小字标签时，visibleFontName 才写“不确定”。
- 返回 JSON，不要 Markdown。

返回 JSON 字段：
{
  "detectedStyle": "标签OCR",
  "visibleFontName": "上方小字标签里的字体名称；看不清才写“不确定”",
  "confidenceNote": "说明是否为上方小字标签OCR；如果不确定，写出原因和可能相近读法",
  "fontType": "标签OCR",
  "weight": "",
  "shapeFeatures": [],
  "hierarchy": "只识别上方字体名称标签，忽略下方展示文案",
  "issues": [],
  "jianyingSearchKeywords": [],
  "similarFonts": [],
  "suitableVideos": [],
  "optimizationSuggestions": [],
  "capcutActionSteps": [],
  "usageReminder": "该结果来自截图标签OCR，不提供字体文件。",
  "limitations": [],
  "uploadAdvice": [],
  "knowledgeBaseMatches": []
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
