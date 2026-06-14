// functions/api/submit.js
import { ok, err, validateLink, genId, getList, setList, sendEmail, buildEmailHtml, escapeHtml } from './_utils.js';

export async function onRequestPost({ request, env, ctx }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return err('请求体不是合法 JSON');
  }
  const errors = validateLink(body);
  if (errors.length) return err('校验失败', 400, { errors });

  // 防止重复：按 link 去重（待审核 + 已通过）
  const pending = await getList(env, 'link:list:pending');
  const approved = await getList(env, 'link:list:approved');
  for (const id of pending) {
    const r = await env.LINKS.get(`link:pending:${id}`);
    if (r) {
      const obj = JSON.parse(r);
      if (obj.link === body.link.trim()) return err('该链接已有待审核申请');
    }
  }
  for (const id of approved) {
    const r = await env.LINKS.get(`link:approved:${id}`);
    if (r) {
      const obj = JSON.parse(r);
      if (obj.link === body.link.trim()) return err('该链接已存在友链');
    }
  }

  const id = genId();
  const record = {
    id,
    title: body.title.trim(),
    avatar: body.avatar.trim(),
    link: body.link.trim(),
    descr: body.descr.trim(),
    rss: (body.rss || '').trim(),
    email: (body.email || '').trim(),
    createdAt: new Date().toISOString()
  };
  await env.LINKS.put(`link:pending:${id}`, JSON.stringify(record));
  pending.push(id);
  await setList(env, 'link:list:pending', pending);

  // 通知管理员（后台发送，不阻塞响应）
  const emailCfg = await env.LINKS.get('config:email');
  if (emailCfg) {
    const adminUrl = new URL(request.url).origin + '/admin';
    const content = `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
        <tr><td style="padding:4px 0"><b style="color:#667eea">标题</b></td></tr>
        <tr><td style="padding:0 0 12px">${escapeHtml(record.title)}</td></tr>
        <tr><td style="padding:4px 0"><b style="color:#667eea">链接</b></td></tr>
        <tr><td style="padding:0 0 12px"><a href="${record.link}" style="color:#667eea">${record.link}</a></td></tr>
        <tr><td style="padding:4px 0"><b style="color:#667eea">描述</b></td></tr>
        <tr><td style="padding:0 0 12px">${escapeHtml(record.descr)}</td></tr>
        <tr><td style="padding:4px 0"><b style="color:#667eea">RSS</b></td></tr>
        <tr><td style="padding:0 0 12px">${record.rss ? `<a href="${record.rss}" style="color:#667eea">${record.rss}</a>` : '<span style="color:#9ca3af">未提供</span>'}</td></tr>
        <tr><td style="padding:4px 0"><b style="color:#667eea">邮箱</b></td></tr>
        <tr><td style="padding:0 0 12px">${record.email || '<span style="color:#9ca3af">未提供</span>'}</td></tr>
      </table>`;
    ctx.waitUntil(sendEmail(env, `【新友链申请】${record.title}`,
      buildEmailHtml('📩 新友链申请', content, '前往审核', adminUrl))
      .catch(e => console.error('通知邮件发送失败:', e.message)));
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
