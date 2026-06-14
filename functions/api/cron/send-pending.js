// functions/api/cron/send-pending.js
// 扫描邮件队列，逐封发送
import { sendEmail } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (!secret || secret !== env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 列出队列中所有邮件
  const list = await env.LINKS.list({ prefix: 'email-queue:' });
  const keys = (list.keys || []).sort((a, b) => a.name.localeCompare(b.name));

  if (keys.length === 0) return new Response('OK (empty)');

  let sent = 0, failed = 0;

  for (const k of keys) {
    try {
      const raw = await env.LINKS.get(k.name);
      if (!raw) { await env.LINKS.delete(k.name); continue; }

      const { subject, html, to } = JSON.parse(raw);
      if (!subject || !html) { await env.LINKS.delete(k.name); continue; }

      await sendEmail(env, subject, html, to || undefined);
      await env.LINKS.delete(k.name);
      sent++;
    } catch (e) {
      console.error(`邮件发送失败 [${k.name}]:`, e.message);
      // 保留失败的任务，下次 cron 重试
      failed++;
    }
  }

  return new Response(`OK sent=${sent} failed=${failed}`);
}
