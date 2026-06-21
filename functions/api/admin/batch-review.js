// functions/api/admin/batch-review.js
// 批量审核：approve / reject / delete
import { ok, err, requireAdmin, getList, setList, queueEmail, buildEmailHtml, escapeHtml } from '../_utils.js';

export async function onRequestGet() {
  return new Response(JSON.stringify({ error: '此接口需要 POST 请求' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);

  let body;
  try { body = await request.json(); } catch { return err('请求体不是 JSON'); }
  const { action, ids, reason } = body;
  if (!action || !ids || !Array.isArray(ids) || !ids.length) return err('action 和 ids 必填');

  let success = 0, failed = 0;

  if (action === 'approve') {
    const pending = await getList(env, 'link:list:pending');
    const approved = await getList(env, 'link:list:approved');
    for (const id of ids) {
      if (!pending.includes(id)) { failed++; continue; }
      const record = JSON.parse(await env.LINKS.get(`link:pending:${id}`) || 'null');
      if (!record) { failed++; continue; }
      record.approvedAt = new Date().toISOString();
      await env.LINKS.put(`link:approved:${id}`, JSON.stringify(record));
      approved.push(id);
      await env.LINKS.delete(`link:pending:${id}`);
      success++;
      // 发通知
      if (record.email) {
        const content = `<font color="#333333" style="color:#333333"><b>${escapeHtml(record.title)}</b>，恭喜！</font>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0fdf4" style="background-color:#f0fdf4;background:#f0fdf4;border-radius:8px;margin:16px 0"><tr><td bgcolor="#f0fdf4" style="background-color:#f0fdf4;background:#f0fdf4;padding:12px 16px">
            <font color="#374151" style="color:#374151">✅ 状态：已通过</font><br>
            <font color="#374151" style="color:#374151">📅 通过时间：${record.approvedAt.slice(0, 10)}</font><br>
            <font color="#374151" style="color:#374151">🔗 你可在此看到你的链接：</font><a href="https://blog.xiaow.qzz.io/links/" target="_blank" style="color:#5046e4"><font color="#5046e4" style="color:#5046e4">blog.xiaow.qzz.io/links</font></a>
          </td></tr></table>`;
        await queueEmail(env, `🎉 友链已通过！${record.title}`,
          buildEmailHtml('✅ 审核通过', content, '查看详情', `${new URL(request.url).origin}/check`), record.email);
      }
    }
    await setList(env, 'link:list:approved', approved);
    await setList(env, 'link:list:pending', pending.filter(id => !ids.includes(id)));
    return ok({ message: `操作完成：${success} 个已通过${failed ? `，${failed} 个失败` : ''}` });
  }

  if (action === 'reject') {
    const pending = await getList(env, 'link:list:pending');
    const rejected = await getList(env, 'link:list:rejected');
    for (const id of ids) {
      if (!pending.includes(id)) { failed++; continue; }
      const record = JSON.parse(await env.LINKS.get(`link:pending:${id}`) || 'null');
      if (!record) { failed++; continue; }
      record.rejectedAt = new Date().toISOString();
      record.rejectReason = reason || '页面内容不符合申请要求';
      await env.LINKS.put(`link:rejected:${id}`, JSON.stringify(record));
      rejected.push(id);
      await env.LINKS.delete(`link:pending:${id}`);
      success++;
    }
    await setList(env, 'link:list:rejected', rejected);
    await setList(env, 'link:list:pending', pending.filter(id => !ids.includes(id)));
    return ok({ message: `操作完成：${success} 个已拒绝${failed ? `，${failed} 个失败` : ''}` });
  }

  if (action === 'delete') {
    for (const status of ['pending', 'approved', 'rejected']) {
      const list = await getList(env, `link:list:${status}`);
      const toDelete = ids.filter(id => list.includes(id));
      for (const id of toDelete) {
        await env.LINKS.delete(`link:${status}:${id}`);
        success++;
      }
      if (toDelete.length) {
        await setList(env, `link:list:${status}`, list.filter(id => !ids.includes(id)));
      }
    }
    return ok({ message: `操作完成：${success} 个已删除${failed ? `，${failed} 个失败` : ''}` });
  }

  return err('不支持的 action');
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}