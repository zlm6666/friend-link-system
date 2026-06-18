// functions/api/submit.js
import { ok, err, validateLink, genId, getList, setList, queueEmail, flushEmailQueue, buildEmailHtml, escapeHtml } from './_utils.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return err('请求体不是合法 JSON');
  }
  const errors = validateLink(body);
  if (errors.length) return err('校验失败', 400, { errors });

  // 防止重复：按 link 去重
  const pending = await getList(env, 'link:list:pending');
  const approved = await getList(env, 'link:list:approved');
  const rejected = await getList(env, 'link:list:rejected');
  const link = body.link.trim();
  for (const id of pending) {
    const r = JSON.parse(await env.LINKS.get(`link:pending:${id}`) || 'null');
    if (r?.link === link) return err('该链接已有待审核申请');
  }
  for (const id of approved) {
    const r = JSON.parse(await env.LINKS.get(`link:approved:${id}`) || 'null');
    if (r?.link === link) return err('该链接已存在友链');
  }

  // 被拒绝后再次提交 → 移回待审核区
  let prevRejectReason = '';
  for (const id of rejected) {
    const r = JSON.parse(await env.LINKS.get(`link:rejected:${id}`) || 'null');
    if (r?.link === link) {
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
