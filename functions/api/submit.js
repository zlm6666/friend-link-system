// functions/api/submit.js
import { ok, err, validateLink, genId, getList, setList, queueEmail, flushEmailQueue, buildEmailHtml, escapeHtml, globalRateLimit } from './_utils.js';

export async function onRequestGet() {
  return new Response(JSON.stringify({ error: '此接口需要 POST 请求' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPost({ request, env }) {
  // Content-Type 不合法直接拒，不碰 KV
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) {
    return err('请使用 JSON 格式提交', 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return err('请求体不是合法 JSON');
  }

  // 表单令牌验证（无状态 HMAC 签名，不碰 KV）
  const token = body._token;
  if (!token) return err('缺少表单令牌，请通过页面提交', 403);
  const parts = token.split('-');
  if (parts.length !== 2) return err('令牌格式错误', 403);
  const ts = parseInt(parts[0], 36);
  if (isNaN(ts) || Date.now() - ts > 300000) return err('令牌已过期，请刷新页面', 403);
  const secret = env.CRON_SECRET || env.LINKS?.id || 'fr1end-l1nk';
  const raw = parts[0] + ':' + secret;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const sig = Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
  if (sig !== parts[1]) return err('令牌无效', 403);
  const errors = validateLink(body);
  if (errors.length) return err('校验失败', 400, { errors });

  // URL 黑名单检查（按根域名匹配）
  const urlBlacklist = JSON.parse(await env.LINKS.get('config:url-blacklist') || '[]');
  const submittedHost = (() => { try { return new URL(body.link).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
  if (urlBlacklist.some(u => u.includes('.') && submittedHost === u.replace(/^www\./, '').toLowerCase())) {
    return err('该链接已被加入黑名单', 403);
  }

  // 全局速率限制：每 300 秒最多 10 次提交
  if (!(await globalRateLimit(env, 'submit', 10, 300))) {
    return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // 防止重复：按 link 去重（忽略末尾斜杠差异）
  const normalizeUrl = u => u.replace(/\/+$/, '');
  const pending = await getList(env, 'link:list:pending');
  // 待审核上限保护
  if (pending.length >= 100) return err('待审核队列已满，请稍后再试', 503);
  const approved = await getList(env, 'link:list:approved');
  const rejected = await getList(env, 'link:list:rejected');
  const link = normalizeUrl(body.link.trim());
  for (const id of pending) {
    const r = JSON.parse(await env.LINKS.get(`link:pending:${id}`) || 'null');
    if (r && normalizeUrl(r.link) === link) return err('该链接已有待审核申请');
  }
  for (const id of approved) {
    const r = JSON.parse(await env.LINKS.get(`link:approved:${id}`) || 'null');
    if (r && normalizeUrl(r.link) === link) return err('该链接已存在友链');
  }

  // 被拒绝后再次提交 → 移回待审核区
  let prevRejectReason = '';
  for (const id of rejected) {
    const r = JSON.parse(await env.LINKS.get(`link:rejected:${id}`) || 'null');
    if (r && normalizeUrl(r.link) === link) {
      prevRejectReason = r.rejectReason || '';
      // 从 rejected 删除
      await env.LINKS.delete(`link:rejected:${id}`);
      await setList(env, 'link:list:rejected', rejected.filter(x => x !== id));
      break;
    }
  }

  const id = genId();
  const record = {
    id,
    title: body.title.trim(),
    avatar: body.avatar.trim(),
    link,
    descr: body.descr.trim(),
    rss: (body.rss || '').trim(),
    email: (body.email || '').trim(),
    remark: (body.remark || '').trim(),
    prevRejectReason, // 上次被拒理由（如果有）
    createdAt: new Date().toISOString()
  };
  await env.LINKS.put(`link:pending:${id}`, JSON.stringify(record));
  pending.push(id);
  await setList(env, 'link:list:pending', pending);

  // 通知管理员（队列异步发送）
  const emailCfg = await env.LINKS.get('config:email');
  if (emailCfg) {
    const cfg = JSON.parse(emailCfg);
    const shouldNotify = cfg.notifyMode === 'fromZero' ? pending.length === 1 : true;
    if (shouldNotify) {
    const adminUrl = new URL(request.url).origin + '/admin';
    const content = `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
        <tr><td style="padding:4px 0"><b style="color:#667eea">标题</b></td></tr>
        <tr><td style="padding:0 0 12px">${escapeHtml(record.title)}</td></tr>
        <p><span class="label">站点地址：</span><a href="${record.link}" style="color:#4f46e5">${record.link}</a></p>
        <p><span class="label">描述：</span>${escapeHtml(record.descr)}</p>
        <p><span class="label">RSS：</span>${record.rss ? `<a href="${record.rss}" style="color:#4f46e5">${record.rss}</a>` : '未提供'}</p>
        <p><span class="label">邮箱：</span>${record.email || '未提供'}</p>
      </table>`;
    await queueEmail(env, `【新友链申请】${record.title}`,
      buildEmailHtml('📩 新友链申请', content, '前往审核', `${adminUrl}`));
    await flushEmailQueue(request, env);
    }
  }

  return ok({ id, message: '申请已提交，请等待审核' });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}
