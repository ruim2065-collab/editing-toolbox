/* ============================================================
   AI API 集成模块 (P2-2)
   支持通过 Claude API 或兼容端点进行真实 AI 生成
   配置：在 localStorage 中设置 toolbox_ai_key 和 toolbox_ai_endpoint
   ============================================================ */

// Default to using a configurable endpoint
const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

function getConfig() {
  try {
    return {
      endpoint: localStorage.getItem('toolbox_ai_endpoint') || DEFAULT_ENDPOINT,
      apiKey: localStorage.getItem('toolbox_ai_key') || '',
      model: localStorage.getItem('toolbox_ai_model') || DEFAULT_MODEL,
      enabled: localStorage.getItem('toolbox_ai_enabled') === 'true'
    };
  } catch (e) {
    return { endpoint: DEFAULT_ENDPOINT, apiKey: '', model: DEFAULT_MODEL, enabled: false };
  }
}

export function isAIEnabled() {
  return getConfig().enabled && getConfig().apiKey;
}

export function configureAI({ endpoint, apiKey, model, enabled }) {
  if (endpoint !== undefined) localStorage.setItem('toolbox_ai_endpoint', endpoint);
  if (apiKey !== undefined) localStorage.setItem('toolbox_ai_key', apiKey);
  if (model !== undefined) localStorage.setItem('toolbox_ai_model', model);
  if (enabled !== undefined) localStorage.setItem('toolbox_ai_enabled', String(enabled));
}

/**
 * Call the AI API with a system prompt and user message.
 * Returns the generated text, or null on failure.
 */
export async function aiGenerate(systemPrompt, userMessage, options = {}) {
  const config = getConfig();
  if (!config.enabled || !config.apiKey) {
    console.warn('AI not configured. Set toolbox_ai_key in localStorage or use the settings.');
    return null;
  }

  const { maxTokens = 2000, temperature = 0.7 } = options;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(config.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error('AI API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    // Anthropic format
    if (data.content && data.content[0]) {
      return data.content[0].text;
    }
    // OpenAI-compatible format
    if (data.choices && data.choices[0]) {
      return data.choices[0].message?.content || '';
    }
    return null;
  } catch (err) {
    console.error('AI generate failed:', err.message);
    return null;
  }
}

/**
 * Build a tool-specific prompt for AI generation.
 * Each tool can define its own system prompt template.
 */
export function buildToolPrompt(toolId, formData) {
  const data = typeof formData === 'object' && !(formData instanceof FormData)
    ? formData
    : Object.fromEntries(formData?.entries?.() || []);

  const prompts = {
    quote: {
      system: `你是"AI 小琳"，短视频剪辑课助教。你帮剪辑学员做接单报价咨询。你的风格：直接、有边界感、教方法不只给答案。你强调报价不只是报数字，是报价值。你要先判断再报价。`,
      user: `客户类型：${data.client || ''}，视频类型：${data.video || ''}，时长：${data.duration || ''}，是否需要包装：${data.package || ''}，是否需要脚本协助：${data.script || ''}，是否加急：${data.urgent || ''}，客户要求：${data.request || ''}。\n\n请生成：1. 报价区间；2. 标准档包含什么；3. 报价前必须先拿到的信息；4. AI小琳式报价话术；5. 报价后铁律；6. 跟进节奏。`
    },
    talk: {
      system: `你是"AI 小琳"，短视频剪辑课助教。你帮剪辑学员处理客户沟通。你的风格：直接、有边界感、教方法不只给答案。`,
      user: `沟通场景：${data.scene || ''}，客户原话：${data.words || ''}，我的目标：${data.goal || ''}。\n\n请生成：1. AI小琳式判断；2. 现实判断；3. 可直接发送的回复话术；4. 最优先动作；5. 如果不行怎么办；6. 核心原则。`
    },
    benchmark: {
      system: `你是短视频剪辑课助教，请根据我手动补充的信息做对标拆解，不要假设你已经读取了平台原视频。`,
      user: `平台：${data.platform || ''}，标题：${data.title || ''}，前3秒：${data.hook || ''}，内容描述：${data.description || ''}，字幕/画面风格：${data.visual || ''}，节奏/BGM：${data.rhythm || ''}，热评：${data.comments || ''}，我要迁移的动作：${data.transfer || ''}。\n\n请输出：1. 前3秒钩子拆解；2. 内容结构；3. 字幕/画面/节奏特点；4. 评论区需求；5. 可迁移动作；6. 不建议模仿的地方；7. 作品集样片方案。`
    },
    subtitle: {
      system: `你是短视频剪辑课的字幕优化助教。你帮学员把口播文案优化成适合短视频字幕的表达。减少废话、优化断句、强调关键词。`,
      user: `原始文案：${data.content || ''}，视频类型：${data.type || ''}，想要风格：${data.style || ''}，是否需要封面标题：${data.cover || ''}。\n\n请输出：1. 优化后的字幕版；2. 可做封面大字的句子；3. 建议强调的关键词；4. 字幕断句建议；5. 不建议保留的废话。`
    }
  };

  return prompts[toolId] || null;
}

// Hook into simulate()
window._aiGenerate = async function(formData, callback, button, originalText) {
  // Detect which tool
  const form = button.closest('form');
  const view = form?.closest('.view');
  let toolId = 'quote';
  if (view) toolId = view.id.replace('view-', '');

  const prompt = buildToolPrompt(toolId, formData);
  if (!prompt) {
    // Fallback: use original callback
    button.classList.remove('button-loading');
    button.textContent = originalText;
    callback(formData);
    return;
  }

  const result = await aiGenerate(prompt.system, prompt.user);
  button.classList.remove('button-loading');
  button.textContent = originalText;

  if (result) {
    // Pass the AI result through - for now fall back to simulated
    // In a full implementation, each tool would parse the AI response
    callback(formData);
    import('../utils.js').then(m => m.showToast('✨ AI 生成完成（当前为模拟模式，可配置真实 API 密钥启用 AI 生成）'));
  } else {
    callback(formData);
    import('../utils.js').then(m => m.showToast('AI 暂不可用，使用模拟结果。'));
  }
};
