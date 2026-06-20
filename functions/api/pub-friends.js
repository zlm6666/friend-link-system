// functions/api/pub-friends.js
// 供 _redirects 重写的内部端点 /api/pub-friends

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  url.pathname = '/api/links-qexo';
  return fetch(new Request(url, { headers: request.headers, method: request.method }));
}

export async function onRequestPost({ request, env }) {
  return onRequestGet({ request, env });
}

export async function onRequestOptions({ request }) {
  const url = new URL(request.url);
  url.pathname = '/api/links-qexo';
  return fetch(url.toString(), { method: 'OPTIONS' });
}