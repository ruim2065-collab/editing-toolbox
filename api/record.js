// Vercel Serverless Function - sync toolbox records to Lark Base.
// Credentials must stay in server-side environment variables.

const DEFAULT_FIELD_MAP = {
  createdAt: '记录时间',
  toolName: '工具',
  status: '状态',
  amount: '金额',
  preview: '摘要',
  full: '完整内容',
  studentName: '学员名称',
  accessType: '访问类型',
  deviceId: '设备ID',
  source: '来源'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    if (!hasRecordConfig()) {
      return res.status(501).json({
        ok: false,
        configured: false,
        error: 'record_sync_not_configured',
        message: '飞书接单记录表暂未配置，本次记录已保存在本机。'
      });
    }

    const record = sanitizeRecord(req.body?.record || {});
    if (!record.toolName && !record.preview) {
      return res.status(400).json({ ok: false, error: 'missing_record' });
    }

    const token = await getLarkTenantToken();
    const created = await createLarkRecord(token, record);
    return res.status(200).json({
      ok: true,
      configured: true,
      recordId: created?.record_id || created?.id || ''
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      configured: hasRecordConfig(),
      error: 'record_sync_failed',
      message: err.message || '飞书接单记录同步失败，本次记录已保存在本机。'
    });
  }
}

function hasRecordConfig() {
  return Boolean(
    process.env.LARK_APP_ID &&
    process.env.LARK_APP_SECRET &&
    process.env.LARK_RECORD_BASE_APP_TOKEN &&
    process.env.LARK_RECORD_TABLE_ID
  );
}

function sanitizeRecord(record) {
  const createdAt = Number(record.time || record.createdAt || Date.now());
  return {
    createdAt: Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : new Date().toISOString(),
    toolId: safeText(record.toolId, 40),
    toolName: safeText(record.toolName || record.tool, 80),
    status: safeText(record.status, 40),
    amount: safeText(record.amount, 40),
    preview: safeText(record.preview || record.summary, 500),
    full: safeText(record.full || record.content || record.preview || record.summary, 3000),
    studentName: safeText(record.studentName, 80),
    accessType: safeText(record.accessType, 60),
    deviceId: safeText(record.deviceId, 120),
    source: safeText(record.source || 'toolbox-web', 80)
  };
}

function safeText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
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

async function createLarkRecord(token, record) {
  const appToken = encodeURIComponent(process.env.LARK_RECORD_BASE_APP_TOKEN);
  const tableId = encodeURIComponent(process.env.LARK_RECORD_TABLE_ID);
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
  const fieldMap = getFieldMap();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: buildFields(record, fieldMap)
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || '飞书接单记录写入失败');
  }
  return data.data?.record || data.data;
}

function getFieldMap() {
  let custom = {};
  try {
    custom = JSON.parse(process.env.LARK_RECORD_FIELD_MAP || '{}');
  } catch (err) {
    custom = {};
  }
  return { ...DEFAULT_FIELD_MAP, ...custom };
}

function buildFields(record, fieldMap) {
  const fields = {};
  fields[fieldMap.createdAt] = record.createdAt;
  fields[fieldMap.toolName] = record.toolName;
  fields[fieldMap.status] = record.status;
  fields[fieldMap.amount] = record.amount;
  fields[fieldMap.preview] = record.preview;
  fields[fieldMap.full] = record.full;
  fields[fieldMap.studentName] = record.studentName;
  fields[fieldMap.accessType] = record.accessType;
  fields[fieldMap.deviceId] = record.deviceId;
  fields[fieldMap.source] = record.source;
  return fields;
}
