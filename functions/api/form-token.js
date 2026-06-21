// functions/api/form-token.js
// 生成一次性表单令牌，防止 API 直接调用 submit
import { genToken } from './_utils.js';

export async function onRequestGet({ env }) {
  const token = genToken(24);
  await env.LINKS.put(`form:token:${token}`, '1', { expirationTtl: 300 });
  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' }
  });
}
