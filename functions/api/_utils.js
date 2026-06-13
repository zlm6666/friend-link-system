// functions/api/_utils.js
// 通用工具：响应包装、KV 操作、密码哈希、Cookie 解析

export function json(data, init = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    ...(init.headers || {})
  };
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export function err(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, { status });
}

export function ok(data = {}) {
  return json({ success: true, data });
}

export function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// 密码哈希：Web Crypto PBKDF2-SHA256
export async function hashPassword(password, saltHex = null) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const hashArr = new Uint8Array(bits);
  const hashHex = Array.from(hashArr).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltOut = saltHex || Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltOut}:${hashHex}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt] = stored.split(':');
  const hashed = await hashPassword(password, salt);
  return hashed === stored;
}

// 解析 Cookie
export function parseCookies(req) {
  const header = req.headers.get('Cookie') || '';
  const out = {};
  header.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k) out[k] = decodeURIComponent(v || '');
  });
  return out;
}

// 管理员鉴权（支持 Authorization header 和 Cookie 两种方式）
export async function requireAdmin(req, env) {
  // 1. 优先检查 Authorization header
  const auth = req.headers.get('Authorization') || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  // 2. 没有则从 Cookie 读
  if (!token) {
    const cookies = parseCookies(req);
    token = cookies['admin_token'] || '';
  }
  if (!token) return { ok: false, reason: '未登录' };
  const session = await env.LINKS.get(`session:${token}`);
  if (!session) return { ok: false, reason: '会话已过期' };
  const obj = JSON.parse(session);
  if (obj.exp < Date.now()) {
    await env.LINKS.delete(`session:${token}`);
    return { ok: false, reason: '会话已过期' };
  }
  return { ok: true, token };
}

export function setSessionCookie(token, expMs) {
  return `admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(expMs / 1000)}`;
}

export function clearSessionCookie() {
  return `admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// 生成 token
export function genToken(len = 32) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 生成 ID
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 简单字段验证
export function validateLink(data) {
  const errors = [];
  if (!data.title || data.title.length > 50) errors.push('标题必填且不超过50字');
  if (!data.link || !/^https?:\/\//i.test(data.link)) errors.push('链接必须以 http/https 开头');
  if (!data.avatar || !/^https?:\/\//i.test(data.avatar)) errors.push('头像必须以 http/https 开头');
  if (!data.descr || data.descr.length > 200) errors.push('描述必填且不超过200字');
  if (data.rss && !/^https?:\/\//i.test(data.rss)) errors.push('RSS 必须以 http/https 开头');
  if (!data.agreed) errors.push('必须同意条款');
  return errors;
}

// 友链列表辅助：原子读改 list
export async function getList(env, key) {
  const raw = await env.LINKS.get(key);
  return raw ? JSON.parse(raw) : [];
}

export async function setList(env, key, arr) {
  await env.LINKS.put(key, JSON.stringify(arr));
}

// 邮件发送（Resend API）
export async function sendEmail(env, subject, html) {
  const raw = await env.LINKS.get('config:email');
  if (!raw) throw new Error('邮件未配置');
  const cfg = JSON.parse(raw);
  if (!cfg.apiKey || !cfg.from || !cfg.to) throw new Error('邮件配置不完整（apiKey/from/to）');

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from,
      to: cfg.to,
      subject,
      html
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`发送失败 (${resp.status}): ${text}`);
  }
  return await resp.json();
}

// 图床上传
export async function uploadToTuCang(env, imageUrl) {
  // 优先级：KV 管理后台配置 > 环境变量 > 内置默认值
  let token, folderId;

  // 1. 读 KV
  const raw = await env.LINKS.get('config:tuCang');
  if (raw) {
    const cfg = JSON.parse(raw);
    token = cfg.token;
    folderId = cfg.folderId;
  }

  // 2. 环境变量覆盖（KV 没有时）
  token = token || env.TUCANG_TOKEN;
  folderId = folderId || env.TUCANG_FOLDER_ID;

  // 3. 内置默认值兜底
  token = token || '1769184743526286121fab11244f28a492ea46ae56e1f';
  folderId = folderId || '3576';

  try {
    const form = new FormData();
    form.append('token', token);
    form.append('folderId', folderId);
    form.append('url', imageUrl);
    const resp = await fetch('https://api.tucang.cc/api/v1/upload', {
      method: 'POST',
      body: form
    });
    const data = await resp.json();
    if (data?.code === '200' && data?.data?.url) {
      return { ok: true, url: data.data.url };
    }
    return { ok: false, url: imageUrl, reason: data?.msg || '上传失败' };
  } catch (e) {
    return { ok: false, url: imageUrl, reason: e.message };
  }
}
