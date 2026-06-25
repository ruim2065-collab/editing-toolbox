// Vercel Serverless Function - URL Content Fetcher
// Handles CORS proxy + metadata extraction for video/social links

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url || (req.body && req.body.url);
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const parsed = new URL(url);
    const platform = detectPlatform(parsed.hostname);

    // Fetch the page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const html = await response.text();
    const result = { platform, url, status: response.status };

    // Extract metadata
    result.title = extractMeta(html, 'og:title') || extractTitle(html) || '';
    result.description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || '';
    result.image = extractMeta(html, 'og:image') || '';
    result.author = extractMeta(html, 'og:site_name') || extractMeta(html, 'author') || '';

    // Platform-specific extraction
    if (platform === 'douyin') {
      result.videoTitle = extractDouyinTitle(html);
      result.musicTitle = extractDouyinMusic(html);
      result.hashtags = extractHashtags(html);
    } else if (platform === 'xiaohongshu') {
      result.noteTitle = extractMeta(html, 'og:title') || extractTitle(html);
      result.hashtags = extractHashtags(html);
    } else if (platform === 'bilibili') {
      result.videoTitle = extractTitle(html);
      result.tags = extractBilibiliTags(html);
    }

    // Font analysis hints (from page content)
    const textSample = extractTextSample(html);
    result.textSample = textSample.substring(0, 200);
    result.fontHints = analyzeFontStyle(textSample, platform);

    // Music/audio hints
    result.musicHints = platform ? getMusicHints(platform, html) : null;

    res.status(200).json(result);
  } catch (err) {
    res.status(200).json({
      error: 'fetch_failed',
      message: err.message,
      url,
      suggestion: '请检查链接是否正确，或尝试手动输入视频信息'
    });
  }
}

function detectPlatform(hostname) {
  if (hostname.includes('douyin.com') || hostname.includes('iesdouyin.com')) return 'douyin';
  if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) return 'xiaohongshu';
  if (hostname.includes('bilibili.com') || hostname.includes('b23.tv')) return 'bilibili';
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
  if (hostname.includes('weibo.com')) return 'weibo';
  return 'web';
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return '';
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractTextSample(html) {
  // Remove scripts, styles, and tags
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.substring(0, 500);
}

function extractHashtags(html) {
  const tags = [];
  const re = /#([一-龥\w]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!tags.includes(m[1])) tags.push(m[1]);
    if (tags.length >= 10) break;
  }
  return tags;
}

function extractDouyinTitle(html) {
  const m = html.match(/"desc"\s*:\s*"([^"]+)"/);
  return m ? m[1] : '';
}

function extractDouyinMusic(html) {
  const m = html.match(/"music"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"/);
  return m ? m[1] : '';
}

function extractBilibiliTags(html) {
  const m = html.match(/"keywords"\s*:\s*"([^"]+)"/);
  return m ? m[1].split(',').map(t => t.trim()) : [];
}

function analyzeFontStyle(text, platform) {
  if (!text) return [];
  const hints = [];
  if (/高级|质感|极简|干净|克制/.test(text)) hints.push('无衬线现代字体（如思源黑体）');
  if (/可爱|活泼|萌|甜/.test(text)) hints.push('圆体/手写体（如得意黑）');
  if (/商业|品牌|专业|大气/.test(text)) hints.push('衬线字体（如思源宋体）');
  if (/综艺|搞笑|网感|炸裂/.test(text)) hints.push('粗体+撞色（如优设标题黑）');
  if (/文艺|情绪|治愈|温柔/.test(text)) hints.push('细字重衬线（如方正静蕾体）');
  if (/科技|数码|硬核|专业/.test(text)) hints.push('几何感无衬线（如HarmonyOS Sans）');
  return hints.length ? hints : ['系统默认字体即可'];
}

function getMusicHints(platform, html) {
  const text = html.toLowerCase();
  const hints = [];
  if (/快节奏|卡点|踩点|燃|炸/.test(text)) hints.push('快节奏电子/Trap - 120-150 BPM');
  if (/温暖|治愈|安静|日系/.test(text)) hints.push('轻钢琴/木吉他 - 60-90 BPM');
  if (/悬疑|紧张|恐怖|惊悚/.test(text)) hints.push('环境电子/弦乐 - 60-100 BPM');
  if (/励志|热血|燃|奋斗/.test(text)) hints.push('流行摇滚/管弦 - 100-140 BPM');
  if (/伤感|情绪|思念|回忆/.test(text)) hints.push('钢琴独奏/弦乐 - 50-80 BPM');

  // Platform-specific defaults
  if (!hints.length) {
    if (platform === 'douyin') hints.push('抖音热曲/流行电子 - 100-130 BPM');
    else if (platform === 'xiaohongshu') hints.push('轻音乐/治愈系 - 70-100 BPM');
    else if (platform === 'bilibili') hints.push('ACG/电子/管弦 - 90-140 BPM');
  }
  return hints;
}
