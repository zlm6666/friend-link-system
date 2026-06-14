import { connect } from 'cloudflare:sockets';

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

// 精美邮件 HTML 模板
export function buildEmailHtml(title, content, btnText, btnUrl) {
  const bgFallback = '#fafafa;background-image:linear-gradient(135deg,#f5f0ff,#eef2ff)';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .body-bg { background:#1a1a2e !important }
    .card-bg { background:#1e1e30 !important;border-color:#2a2a40 !important }
    .text-main { color:#e0e0e0 !important }
    .text-sub { color:#a0a0b0 !important }
    .footer-bg { background:#222238 !important;border-color:#2a2a40 !important }
    .divider { background:#2a2a40 !important }
  }
</style></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',Roboto,sans-serif">
<table class="body-bg" width="100%" cellpadding="0" cellspacing="0" style="background:${bgFallback};padding:40px 12px">
<tr><td align="center">

  <!-- 卡片 -->
  <table class="card-bg" width="100%" style="max-width:540px;background:#fff;border:1px solid #e8e8f0;border-radius:10px;overflow:hidden">
    <!-- 顶栏 -->
    <tr><td style="background:linear-gradient(135deg,#5b6ee5,#6c4fa7);padding:0">
      <div style="padding:30px 36px 24px;text-align:center">
        <table cellpadding="0" cellspacing="0" align="center" style="margin-bottom:10px">
          <tr><td style="width:5px;height:5px;background:rgba(255,255,255,.3);border-radius:50%;margin:0 3px"></td>
              <td style="width:5px;height:5px;background:rgba(255,255,255,.55);border-radius:50%;margin:0 3px"></td>
              <td style="width:5px;height:5px;background:rgba(255,255,255,.3);border-radius:50%;margin:0 3px"></td></tr>
        </table>
        <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:.3px">${title}</p>
      </div>
    </td></tr>
    <!-- 内容 -->
    <tr><td style="padding:28px 36px 20px">
      <div class="text-main" style="font-size:15px;line-height:1.8;color:#374151">
        ${content}
      </div>
    </td></tr>
    <!-- 按钮 -->
    ${btnText && btnUrl ? `<tr><td style="padding:0 36px 28px;text-align:center">
      <table cellpadding="0" cellspacing="0" align="center">
        <tr><td style="background:#5b6ee5;border-radius:7px">
          <a href="${btnUrl}" style="display:inline-block;color:#fff;text-decoration:none;padding:12px 30px;font-size:14px;font-weight:600">${btnText}</a>
        </td></tr>
      </table>
    </td></tr>` : ''}
    <!-- 底栏 -->
    <tr class="footer-bg"><td style="padding:16px 36px;background:#fafafd;border-top:1px solid #f0f0f8;text-align:center;font-size:11px;color:#a0a0b8;line-height:1.8">
      友链管理系统 · 自动通知，请勿回复
    </td></tr>
  </table>

  <div class="text-sub" style="padding:14px 10px 0;text-align:center;font-size:11px;color:#c0c5d1">Tencent ima.copilot</div>
</td></tr></table></body></html>`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// 邮件发送，to 可选，不传则用配置中的收件邮箱
export async function sendEmail(env, subject, html, to) {
  const raw = await env.LINKS.get('config:email');
  if (!raw) throw new Error('邮件未配置');
  const cfg = JSON.parse(raw);
  if (!cfg.to && !to) throw new Error('收件邮箱未配置');

  const provider = cfg.provider || 'resend';

  if (provider === 'smtp') {
    const smtpCfg = JSON.parse(await env.LINKS.get('config:smtp') || 'null');
    if (!smtpCfg) throw new Error('SMTP 未配置');
    if (!cfg.apiKey) throw new Error('API Key 未配置');
    return sendViaSmtp(smtpCfg, subject, html, to || cfg.to);
  }

  // Resend / SendGrid 需要 apiKey 和 from
  if (!cfg.apiKey || !cfg.from) throw new Error('邮件配置不完整（apiKey/from）');

  if (provider === 'sendgrid') {
    return sendViaSendgrid(cfg, subject, html, to || cfg.to);
  }

  // 默认 Resend
  return sendViaResend(cfg, subject, html, to || cfg.to);
}

async function sendViaResend(cfg, subject, html, to) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from,
      to: to || cfg.to,
      subject,
      html
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Resend 发送失败 (${resp.status}): ${text}`);
  }
  return await resp.json();
}

async function sendViaSendgrid(cfg, subject, html, to) {
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to || cfg.to }] }],
      from: { email: cfg.from, name: cfg.fromName || '' },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SendGrid 发送失败 (${resp.status}): ${text}`);
  }
  return await resp.json();
}

// SMTP 直发（通过 QQ 邮箱等，使用 connect() API）
async function sendViaSmtp(cfg, subject, html, to) {
  const sock = connect({ hostname: cfg.host, port: cfg.port || 465 }, { secureTransport: 'on' });
  const reader = sock.readable.getReader();
  const writer = sock.writable.getWriter();
  const enc = new TextEncoder();
  let buf = '';

  async function readLine() {
    while (true) {
      const idx = buf.indexOf('\r\n');
      if (idx >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        return line;
      }
      const { done, value } = await reader.read();
      if (done) throw new Error('SMTP 连接中断');
      buf += new TextDecoder().decode(value);
    }
  }

  async function cmd(text) {
    await writer.write(enc.encode(text + '\r\n'));
    return readLine();
  }

  // 读 banner
  let resp = await readLine();
  if (!resp.startsWith('220')) throw new Error(`SMTP 连接失败: ${resp}`);

  // EHLO
  resp = await cmd('EHLO friend-link-system');
  while (resp.startsWith('250-')) resp = await readLine();
  if (!resp.startsWith('250')) throw new Error(`EHLO 失败: ${resp}`);

  // AUTH LOGIN
  resp = await cmd('AUTH LOGIN');
  if (!resp.startsWith('334')) throw new Error(`AUTH 失败: ${resp}`);
  resp = await cmd(btoa(cfg.user));
  if (!resp.startsWith('334')) throw new Error(`用户名验证失败: ${resp}`);
  resp = await cmd(btoa(cfg.password));
  if (!resp.startsWith('235')) throw new Error(`密码验证失败: ${resp}`);

  // MAIL FROM
  resp = await cmd(`MAIL FROM:<${cfg.from}>`);
  if (!resp.startsWith('250')) throw new Error(`MAIL FROM 失败: ${resp}`);

  // RCPT TO
  resp = await cmd(`RCPT TO:<${to}>`);
  if (!resp.startsWith('250')) throw new Error(`RCPT TO 失败: ${resp}`);

  // DATA
  resp = await cmd('DATA');
  if (!resp.startsWith('354')) throw new Error(`DATA 失败: ${resp}`);

  // 发送邮件内容
  const fromDisplay = cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from;
  const body = `From: ${fromDisplay}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n.`;
  resp = await cmd(body);
  if (!resp.startsWith('250')) throw new Error(`邮件发送失败: ${resp}`);

  await cmd('QUIT');
  writer.close();
  return resp;
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
  token = token || '000000000000000000000000000000000000000000000';
  folderId = folderId || '0000';

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
