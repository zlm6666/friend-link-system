// functions/api/cron/send-pending.js
// 扫描邮件队列，逐封发送——带锁防并发、批次限制、失败重试
import { sendEmail } from '../_utils.js';

const MAX_BATCH = 10;   // 单次 cron 最多发 N 封
const MAX_RETRIES = 3;  // 单封邮件最大重试次数
const LOCK_KEY = 'email-queue:lock';
const LOCK_TTL = 60;    // 锁 60 秒自动释放（防实例崩溃死锁）

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (!secret || secret !== env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 分布式锁：避免并发 cron 重复处理
  const existingLock = await env.LINKS.get(LOCK_KEY);
  if (existingLock) {
    return new Response(`OK (locked by ${existingLock})`, { status: 200 });
  }
  await env.LINKS.put(LOCK_KEY, String(Date.now()), { expirationTtl: LOCK_TTL });

  try {
    const list = await env.LINKS.list({ prefix: 'email-queue:', limit: 50 });
    const keys = (list.keys || []).sort((a, b) => a.name.localeCompare(b.name));

    if (keys.length === 0) return new Response('OK (empty)');

    let sent = 0, failed = 0, skipped = 0;

    for (const k of keys) {
      if (sent + failed >= MAX_BATCH) { skipped = keys.length - sent - failed; break; }

      const raw = await env.LINKS.get(k.name);
      if (!raw) continue; // 已经被其他实例删了

      let entry;
      try { entry = JSON.parse(raw); } catch { await env.LINKS.delete(k.name); continue; }
      if (!entry.subject || !entry.html) { await env.LINKS.delete(k.name); continue; }

      try {
        await sendEmail(env, entry.subject, entry.html, entry.to || undefined);
        await env.LINKS.delete(k.name);
        sent++;
      } catch (e) {
        console.error(`[send-pending] ${k.name}:`, e.message);
        const retryCount = (entry.retries || 0) + 1;
        if (retryCount >= MAX_RETRIES) {
          await env.LINKS.delete(k.name);
          console.error(`[send-pending] ${k.name}: 重试${MAX_RETRIES}次均失败，已废弃`);
        } else {
          entry.retries = retryCount;
          await env.LINKS.put(k.name, JSON.stringify(entry));
          failed++;
        }
      }
    }

    const remain = keys.length - sent - failed;
    return new Response(`OK sent=${sent} failed=${failed} skip=${skipped} remain=${remain}`);
  } finally {
    await env.LINKS.delete(LOCK_KEY);
  }
}
