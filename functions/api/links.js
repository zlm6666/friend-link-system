// functions/api/links.js
// 返回已通过的友链，严格按指定 JSON 格式
import { getList, globalRateLimit } from './_utils.js';

export async function onRequestGet({ env, request }) {
  if (!(await globalRateLimit(env, 'links', 100, 60))) {
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
  const out = sorted.map(r => ({
    name: r.title, link: r.link, avatar: r.avatar, descr: r.descr
  }));
  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=7200, s-maxage=14400'
    }
  });
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
