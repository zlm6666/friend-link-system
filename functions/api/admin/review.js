// functions/api/admin/review.js
// 审核操作：approve / reject / delete
import { ok, err, requireAdmin, getList, setList, uploadToTuCang, queueEmail, flushEmailQueue, buildEmailHtml, escapeHtml } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);

  let body;
  try { body = await request.json(); } catch { return err('请求体不是 JSON'); }
  const { action, id } = body;
  if (!action || !id) return err('action 和 id 必填');

  if (action === 'approve') {
    const pending = await getList(env, 'link:list:pending');
    if (!pending.includes(id)) return err('记录不存在');
    const record = JSON.parse(await env.LINKS.get(`link:pending:${id}`) || 'null');
    if (!record) return err('记录不存在');

    // 上传头像到图床
    const up = await uploadToTuCang(env, record.avatar);
    if (up.ok) record.avatar = up.url;

    record.approvedAt = new Date().toISOString();

    // 移到 approved
    const approved = await getList(env, 'link:list:approved');
    await env.LINKS.put(`link:approved:${id}`, JSON.stringify(record));
    approved.push(id);
    await setList(env, 'link:list:approved', approved);
    await env.LINKS.delete(`link:pending:${id}`);
    await setList(env, 'link:list:pending', pending.filter(x => x !== id));

    // 通知申请人（队列异步发送）
    if (record.email) {
      const origin = new URL(request.url).origin;
      const content = `
        <p style="margin:0 0 16px">🎉 <b>${escapeHtml(record.title)}</b>，恭喜！</p>
        <p style="margin:0 0 16px;color:#6b7280">您的友链申请已通过审核，现在已展示在友链列表中。</p>
        <table width="100%" style="background:#f0fdf4;border-radius:8px;padding:12px 16px;font-size:13px;color:#374151">
          <tr><td>✅ 状态：已通过</td></tr>
          <tr><td>📅 通过时间：${new Date().toISOString().slice(0, 10)}</td></tr>
        </table>`;
      await queueEmail(env, `🎉 友链已通过！${record.title}`,
        buildEmailHtml('✅ 审核通过', content, '查看详情', `${origin}/cheak`), record.email);
      // 立即触发发送
      await flushEmailQueue(request, env);
    }

    return ok({ message: '已通过', record });
  }

  if (action === 'reject') {
    const pending = await getList(env, 'link:list:pending');
    if (!pending.includes(id)) return err('记录不存在');
    const record = JSON.parse(await env.LINKS.get(`link:pending:${id}`) || 'null');
    if (!record) return err('记录不存在');
    record.rejectedAt = new Date().toISOString();
    record.rejectReason = body.reason || '页面内容不符合申请要求';

    const rejected = await getList(env, 'link:list:rejected');
    await env.LINKS.put(`link:rejected:${id}`, JSON.stringify(record));
    rejected.push(id);
    await setList(env, 'link:list:rejected', rejected);
    await env.LINKS.delete(`link:pending:${id}`);
    await setList(env, 'link:list:pending', pending.filter(x => x !== id));

    // 通知申请人（队列异步发送）
    if (record.email) {
      const origin = new URL(request.url).origin;
      const reasonBlock = record.rejectReason
        ? `<table width="100%" style="background:#fef2f2;border-radius:8px;padding:12px 16px;font-size:13px;color:#991b1b;margin:0 0 16px"><tr><td>📌 拒绝原因：${escapeHtml(record.rejectReason)}</td></tr></table>`
        : '';
      const content = `
        <p style="margin:0 0 16px">😅 <b>${escapeHtml(record.title)}</b>，很抱歉</p>
        <p style="margin:0 0 16px;color:#6b7280">您的友链申请未通过审核。</p>
        ${reasonBlock}
        <p style="margin:0;color:#9ca3af;font-size:13px">如果仍有疑问，可以重新提交申请</p>`;
      await queueEmail(env, `😅 友链未通过 - ${record.title}`,
        buildEmailHtml('❌ 未通过审核', content, '查看详情', `${origin}/cheak`), record.email);
      // 立即触发发送
      await flushEmailQueue(request, env);
    }

    return ok({ message: '已拒绝' });
  }

  if (action === 'delete') {
    // 删除任何状态的记录
    for (const status of ['pending', 'approved', 'rejected']) {
      const list = await getList(env, `link:list:${status}`);
      if (list.includes(id)) {
        await env.LINKS.delete(`link:${status}:${id}`);
        await setList(env, `link:list:${status}`, list.filter(x => x !== id));
        return ok({ message: '已删除' });
      }
    }
    return err('记录不存在');
  }

  if (action === 'edit') {
    const { data } = body;
    if (!data) return err('缺少 data');
    // 遍历三个状态找到记录
    for (const status of ['pending', 'approved', 'rejected']) {
      const list = await getList(env, `link:list:${status}`);
      if (list.includes(id)) {
        const raw = await env.LINKS.get(`link:${status}:${id}`);
        if (!raw) return err('记录不存在');
        const record = JSON.parse(raw);
        // 更新字段（仅更新传了的）
        if (data.title !== undefined) record.title = data.title.trim();
        if (data.avatar !== undefined) record.avatar = data.avatar.trim();
        if (data.link !== undefined) record.link = data.link.trim();
        if (data.descr !== undefined) record.descr = data.descr.trim();
        if (data.rss !== undefined) record.rss = data.rss.trim();
        record.updatedAt = new Date().toISOString();
        await env.LINKS.put(`link:${status}:${id}`, JSON.stringify(record));
        return ok({ message: '已更新', record });
      }
    }
    return err('记录不存在');
  }

  if (action === 'pin' || action === 'unpin') {
    for (const status of ['pending', 'approved', 'rejected']) {
      const list = await getList(env, `link:list:${status}`);
      if (list.includes(id)) {
        const raw = await env.LINKS.get(`link:${status}:${id}`);
        if (!raw) return err('记录不存在');
        const record = JSON.parse(raw);
        record.pinned = action === 'pin';
        await env.LINKS.put(`link:${status}:${id}`, JSON.stringify(record));
        return ok({ message: action === 'pin' ? '已置顶' : '已取消置顶', record });
      }
    }
    return err('记录不存在');
  }

  if (action === 'changeStatus') {
    const { id, newStatus, reason, notify } = body;
    if (!newStatus || !['pending', 'approved', 'rejected'].includes(newStatus)) return err('无效状态');

    try {
      for (const status of ['pending', 'approved', 'rejected']) {
        const list = await getList(env, `link:list:${status}`);
        if (list.includes(id)) {
          const raw = await env.LINKS.get(`link:${status}:${id}`);
          if (!raw) return err('记录不存在');
          const record = JSON.parse(raw);

          // 从原状态列表删除
          await setList(env, `link:list:${status}`, list.filter(x => x !== id));
          await env.LINKS.delete(`link:${status}:${id}`);

          // 更新记录字段
          if (newStatus === 'approved') {
            record.approvedAt = new Date().toISOString();
            delete record.rejectedAt;
            delete record.rejectReason;
            // 重新上传头像到图床
            const up = await uploadToTuCang(env, record.avatar);
            if (up.ok) record.avatar = up.url;
          } else if (newStatus === 'rejected') {
            record.rejectedAt = new Date().toISOString();
            record.rejectReason = reason || '';
            delete record.approvedAt;
          } else {
            delete record.approvedAt;
            delete record.rejectedAt;
            delete record.rejectReason;
          }

          // 加到新状态列表
          const newList = await getList(env, `link:list:${newStatus}`);
          await env.LINKS.put(`link:${newStatus}:${id}`, JSON.stringify(record));
          newList.push(id);
          await setList(env, `link:list:${newStatus}`, newList);

          // 发通知
          if (notify && record.email && newStatus !== 'pending') {
          const origin = new URL(request.url).origin;
          const oldStatus = status;
          if (newStatus === 'approved') {
            const restored = oldStatus === 'rejected';
            const s = restored ? '🔄 已恢复展示' : '✅ 审核通过';
            const statusLabel = restored ? '已恢复' : '已通过';
            const content = `<p>您好 <strong>${escapeHtml(record.title)}</strong>，</p>
<p>感谢您对本站的关注与喜爱，您提交的友链申请我们已经处理完毕。</p>
<div class="info-card">
<p><span class="label">站点名称：</span>${escapeHtml(record.title)}</p>
<p><span class="label">站点地址：</span>${record.link}</p>
<p><span class="label">申请状态：</span><span class="status-badge">${statusLabel}</span></p>
</div>
<p>${restored?'您的友链已恢复展示。':'恭喜！您的站点符合本站的友链标准，现已成功添加至友链页面。'}</p>
<p>期待在未来的日子里，我们能通过文字产生更多的共鸣与连接。如果您发现信息有误，或有其他事宜，欢迎随时来信交流。</p>`;
            await queueEmail(env, `${s}！${record.title}`,
              buildEmailHtml(s, content, '前往查看友链', 'https://blog.xiaow.qzz.io/links/'), record.email);
          } else if (newStatus === 'rejected') {
            const blocked = oldStatus === 'approved';
            const s = blocked ? '⛔ 暂时被屏蔽' : '❌ 未通过审核';
            const statusLabel = blocked ? '已屏蔽' : '未通过';
            const statusColor = blocked ? '#dc2626' : '#dc2626';
            const reasonBlock = record.rejectReason
              ? `<p>原因：${escapeHtml(record.rejectReason)}</p>`
              : '';
            const content = `<p>您好 <strong>${escapeHtml(record.title)}</strong>，</p>
<p>感谢您对本站的关注与喜爱。</p>
<div class="info-card">
<p><span class="label">站点名称：</span>${escapeHtml(record.title)}</p>
<p><span class="label">站点地址：</span>${record.link}</p>
<p><span class="label">申请状态：</span><span class="status-badge">${statusLabel}</span></p>
</div>
${blocked
  ? `<p>您的友链暂时被屏蔽，请检查内容是否符合规范。</p>${reasonBlock}<p>修改后可以重新提交申请恢复展示。</p>`
  : `<p>很抱歉，经过审核，您的站点暂时不符合本站的友链添加标准。</p>
<p>为了保证友链圈的质量，我们通常会优先考虑<strong>内容原创度高、长期稳定更新且主题相近</strong>的博客。${reasonBlock}</p>
<p>虽然这次未能成功，但仍然非常感谢您的支持。期待未来能在评论区见到您的身影！</p>`}`;
            await queueEmail(env, `${s} - ${record.title}`,
              buildEmailHtml(s, content, blocked ? '' : '查看详情', blocked ? '' : `${origin}/cheak`), record.email);
          }
          // 立即触发发送
          await flushEmailQueue(request, env);
        }

        return ok({ message: '状态已变更', record });
      }
    }
    return err('记录不存在');
  } catch (e) {
    console.error('changeStatus 错误:', e.message);
    return err('状态变更失败: ' + e.message);
  }
  }

  return err('未知 action');
}

export async function onRequestOptions() { return new Response(null, { status: 204 }); }
