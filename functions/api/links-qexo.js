// functions/api/links-qexo.js
// Qexo 兼容格式的友链 API
import { getList, globalRateLimit } from './_utils.js';

export async function onRequestGet({ env, request }) {
  if (!(await globalRateLimit(env, 'links-qexo', 100, 60))) {
    return new Response(JSON.stringify({ error: '请求过于频繁' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  const ids = await getList(env, 'link:list:approved');
  const items = [];
  for (const id of ids) {
    const r = JSON.parse(await env.LINKS.get(`link:approved:${id}`) || 'null');
    if (!r) continue;
    items.push(r);
  }
  // 置顶排最前，其余随机打乱
  const pinned = items.filter(r => r.pinned);
  const unpinned = items.filter(r => !r.pinned);
  shuffle(unpinned);
  const sorted = [...pinned, ...unpinned];
  const data = sorted.map(r => ({
    name: r.title, url: r.link, image: r.avatar, description: r.descr
  }));
  const body = JSON.stringify({ data, status: true }, null, 2);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=7200, s-maxage=14400'
    }
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
  });
}
