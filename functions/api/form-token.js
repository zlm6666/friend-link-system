// functions/api/form-token.js
// 生成一次性表单令牌（无状态 HMAC 签名，不碰 KV）
export async function onRequestGet({ env }) {
  const ts = Date.now().toString(36);
  const secret = env.CRON_SECRET || env.LINKS?.id || 'fr1end-l1nk';
  const raw = ts + ':' + secret;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const sig = Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
  return new Response(JSON.stringify({ token: ts + '-' + sig }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' }
  });
}
