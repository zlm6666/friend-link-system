// functions/api/admin/test-email.js
import { ok, err, requireAdmin, sendEmail, buildEmailHtml } from '../_utils.js';

const TEMPLATES = {
  test: {
    subject: '【测试邮件】友链系统配置成功',
    title: '📧 测试邮件',
    content: `<p>这是一封纯测试邮件。</p><p>如果你收到它，说明邮件配置正确。</p>`
  },
  approved: {
    subject: '【测试】友链审核通过',
    title: '✅ 审核通过',
    content: `<p>🎉 <b>测试站点</b>，恭喜！</p><p style="color:#6b7280">您的友链申请已通过审核，现在已展示在友链列表中。</p>
      <table width="100%" style="background:#f0fdf4;border-radius:8px;padding:12px 16px;font-size:13px;color:#374151">
        <tr><td>✅ 状态：已通过</td></tr><tr><td>📅 通过时间：${new Date().toISOString().slice(0, 10)}</td></tr></table>`
  },
  rejected: {
    subject: '【测试】友链未通过',
    title: '❌ 未通过审核',
    content: `<p>😅 <b>测试站点</b>，很抱歉</p><p style="color:#6b7280">您的友链申请未通过审核。</p>
      <table width="100%" style="background:#fef2f2;border-radius:8px;padding:12px 16px;font-size:13px;color:#991b1b">
        <tr><td>📌 拒绝原因：页面内容不符合申请要求</td></tr></table>`
  },
  blocked: {
    subject: '【测试】友链被屏蔽',
    title: '⛔ 暂时被屏蔽',
    content: `<p>⚠️ <b>测试站点</b>，请注意</p><p style="color:#6b7280">您的友链暂时被屏蔽，请检查是否符合规范。</p>
      <p style="color:#9ca3af;font-size:13px">修改后可以重新提交恢复展示</p>`
  },
  restored: {
    subject: '【测试】友链已恢复',
    title: '🔄 已恢复展示',
    content: `<p>🎉 <b>测试站点</b>，好消息！</p><p style="color:#6b7280">您的友链已恢复展示。</p>`
  },
  remind: {
    subject: '【测试】审核提醒',
    title: '📋 待审核提醒',
    content: `<p>👋 管理员你好，</p><p style="color:#6b7280">您有新的友链申请待审核，请前往后台查看。</p>`
  }
};

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);

  let body;
  try { body = await request.json(); } catch { return err('请求体不是 JSON'); }
  const type = body.type || 'test';

  const tpl = TEMPLATES[type] || TEMPLATES.test;
  try {
    await sendEmail(env, tpl.subject,
      buildEmailHtml(tpl.title, tpl.content, type === 'remind' ? '前往审核' : '', type === 'remind' ? '/admin' : ''));
    return ok({ message: '已发送', type });
  } catch (e) {
    return err('发送失败: ' + e.message);
  }
}

export async function onRequestOptions() { return new Response(null, { status: 204 }); }
