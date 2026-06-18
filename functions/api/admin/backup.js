// functions/api/admin/backup.js
// 导入导出全部数据
import { ok, err, requireAdmin, getList } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);

  const data = {};
  // 导出所有状态和列表
  for (const status of ['pending', 'approved', 'rejected']) {
    data[status] = [];
    const ids = await getList(env, `link:list:${status}`);
    for (const id of ids) {
      const raw = await env.LINKS.get(`link:${status}:${id}`);
      if (raw) data[status].push(JSON.parse(raw));
    }
  }
  data.exportedAt = new Date().toISOString();
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="friend-links-backup.json"'
    }
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);

  let body;
  try { body = await request.json(); } catch { return err('请上传 JSON 备份文件'); }

  let imported = 0;
  for (const status of ['pending', 'approved', 'rejected']) {
    const records = body[status];
    if (!Array.isArray(records)) continue;

    const ids = [];
    for (const r of records) {
      if (!r.id || !r.title || !r.link) continue;
      await env.LINKS.put(`link:${status}:${r.id}`, JSON.stringify(r));
      ids.push(r.id);
      imported++;
    }
    // 修复列表
    const existing = await getList(env, `link:list:${status}`);
    const merged = [...new Set([...existing, ...ids])];
    await env.LINKS.put(`link:list:${status}`, JSON.stringify(merged));
  }

  return ok({ message: `已导入 ${imported} 条记录` });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
  });
}
