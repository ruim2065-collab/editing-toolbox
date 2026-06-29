// Vercel Serverless Function - toolbox access verification.
// Access codes and credentials must stay in server-side environment variables.

const SESSION_TTL_DAYS = Number(process.env.TOOLBOX_SESSION_DAYS || 7);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    const { code, deviceId } = req.body || {};
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
      return res.status(400).json({ ok: false, error: 'missing_code', message: '请输入访问密码或学员专属码。' });
    }

    const configured = hasAnyAuthConfig();
    if (!configured) {
      return res.status(501).json({
        ok: false,
        configured: false,
        error: 'auth_not_configured',
        message: '访问验证暂未配置。请先在 Vercel 环境变量中配置 TOOLBOX_ACCESS_PASSWORD 或 TOOLBOX_STUDENT_CODES。'
      });
    }

    const passwordMatch = checkSharedPassword(normalizedCode);
    if (passwordMatch.ok) return allow(res, passwordMatch);

    const localCodeMatch = checkLocalStudentCodes(normalizedCode);
    if (localCodeMatch.ok) return allow(res, localCodeMatch);

    const larkMatch = await checkLarkStudentCode(normalizedCode, deviceId);
    if (larkMatch.ok) return allow(res, larkMatch);

    return res.status(401).json({
      ok: false,
      configured: true,
      error: 'invalid_code',
      message: larkMatch.message || '访问码无效、已停用或已过期。'
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      configured: true,
      error: 'auth_failed',
      message: err.message || '访问验证失败，请稍后重试。'
    });
  }
}

function allow(res, match) {
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  return res.status(200).json({
    ok: true,
    configured: true,
    accessType: match.accessType,
    displayName: match.displayName || '剪辑课学员',
    expiresAt,
    message: '验证通过'
  });
}

function normalizeCode(value) {
  return String(value || '').trim();
}

function normalizeComparable(value) {
  return normalizeCode(value).toLowerCase();
}

function hasAnyAuthConfig() {
  return Boolean(
    process.env.TOOLBOX_ACCESS_PASSWORD ||
    process.env.TOOLBOX_STUDENT_CODES ||
    hasLarkConfig()
  );
}

function checkSharedPassword(code) {
  const password = process.env.TOOLBOX_ACCESS_PASSWORD;
  if (!password) return { ok: false };
  if (normalizeComparable(code) !== normalizeComparable(password)) return { ok: false };
  return { ok: true, accessType: 'shared-password', displayName: '剪辑课学员' };
}

function checkLocalStudentCodes(code) {
  const raw = process.env.TOOLBOX_STUDENT_CODES;
  if (!raw) return { ok: false };

  const target = normalizeComparable(code);
  const parsed = parseStudentCodes(raw);
  for (const item of parsed) {
    if (normalizeComparable(item.code) !== target) continue;
    if (item.enabled === false) return { ok: false, message: '该学员码已停用。' };
    if (item.expiresAt && Date.parse(item.expiresAt) < Date.now()) return { ok: false, message: '该学员码已过期。' };
    return { ok: true, accessType: 'student-code', displayName: item.name || '剪辑课学员' };
  }

  return { ok: false };
}

function parseStudentCodes(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      return json.map(item => typeof item === 'string' ? { code: item } : item).filter(item => item?.code);
    }
  } catch (err) {
    // Comma/newline separated fallback.
  }
  return text.split(/[\n,，]+/).map(code => ({ code: code.trim() })).filter(item => item.code);
}

function hasLarkConfig() {
  return Boolean(
    process.env.LARK_APP_ID &&
    process.env.LARK_APP_SECRET &&
    process.env.LARK_BASE_APP_TOKEN &&
    process.env.LARK_BASE_TABLE_ID
  );
}

async function checkLarkStudentCode(code) {
  if (!hasLarkConfig()) return { ok: false };

  const token = await getLarkTenantToken();
  const records = await listLarkRecords(token);
  const target = normalizeComparable(code);

  for (const record of records) {
    const fields = record.fields || {};
    const recordCode = getFieldValue(fields, ['访问码', 'access_code', 'code', '学员码']);
    if (normalizeComparable(recordCode) !== target) continue;

    const enabled = getFieldValue(fields, ['是否有效', 'enabled', '有效']);
    if (enabled === false || normalizeComparable(enabled) === 'false' || normalizeComparable(enabled) === '否') {
      return { ok: false, message: '该学员码已停用。' };
    }

    const expiresAt = getFieldValue(fields, ['到期时间', 'expires_at', '过期时间']);
    if (expiresAt && Date.parse(expiresAt) < Date.now()) {
      return { ok: false, message: '该学员码已过期。' };
    }

    return {
      ok: true,
      accessType: 'lark-student-code',
      displayName: getFieldValue(fields, ['姓名', 'name', '学员姓名']) || '剪辑课学员'
    };
  }

  return { ok: false };
}

async function getLarkTenantToken() {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(data.msg || '飞书访问令牌获取失败');
  }
  return data.tenant_access_token;
}

async function listLarkRecords(token) {
  const appToken = encodeURIComponent(process.env.LARK_BASE_APP_TOKEN);
  const tableId = encodeURIComponent(process.env.LARK_BASE_TABLE_ID);
  const pageSize = Number(process.env.LARK_BASE_PAGE_SIZE || 500);
  const records = [];
  let pageToken = '';

  do {
    const url = new URL(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set('page_size', String(pageSize));
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.code !== 0) throw new Error(data.msg || '飞书学员名单读取失败');

    records.push(...(data.data?.items || []));
    pageToken = data.data?.page_token || '';
  } while (pageToken && records.length < 2000);

  return records;
}

function getFieldValue(fields, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(fields, name)) {
      const value = fields[name];
      if (Array.isArray(value)) return value.map(item => item?.text || item?.name || item).join('');
      if (value && typeof value === 'object') return value.text || value.name || value.value || '';
      return value;
    }
  }
  return '';
}
