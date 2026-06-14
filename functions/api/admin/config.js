// functions/api/admin/config.js
// 邮件配置（Resend）+ 图床配置 + AI 配置
import { ok, err, requireAdmin } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);
  const email = JSON.parse(await env.LINKS.get('config:email') || 'null');
  const tuCang = JSON.parse(await env.LINKS.get('config:tuCang') || 'null');
  const ai = JSON.parse(await env.LINKS.get('config:ai') || 'null');
  const safe = (obj) => obj ? {
    ...obj,
    apiKey: obj.apiKey ? '******' : '',
    token: obj.token ? '******' : ''
  } : null;
  return ok({
    email: safe(email),
    tuCang: safe(tuCang),
    ai: safe(ai)
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);

  let body;
  try { body = await request.json(); } catch { return err('请求体不是 JSON'); }
  const { type, data } = body;

  if (type === 'email') {
    if (data.apiKey === '******') {
      const old = JSON.parse(await env.LINKS.get('config:email') || '{}');
      data.apiKey = old.apiKey || '';
    }
    if (!data.apiKey || !data.from || !data.to) return err('apiKey、from、to 必填');
    await env.LINKS.put('config:email', JSON.stringify({
      apiKey: data.apiKey.trim(),
      from: data.from.trim(),
      fromName: (data.fromName || '').trim(),
      to: data.to.trim(),
      qqSmtpFrom: (data.qqSmtpFrom || '').trim()
    }));
    return ok({ message: '邮件配置已保存' });
  }

  if (type === 'tucang') {
    if (data.token === '******') {
      const old = JSON.parse(await env.LINKS.get('config:tuCang') || '{}');
      data.token = old.token || '';
    }
    if (!data.token || !data.folderId) return err('token 和 folderId 必填');
    await env.LINKS.put('config:tuCang', JSON.stringify(data));
    return ok({ message: '图床配置已保存' });
  }

  if (type === 'ai') {
    if (data.apiKey === '******') {
      const old = JSON.parse(await env.LINKS.get('config:ai') || '{}');
      data.apiKey = old.apiKey || '';
    }
    if (!data.apiKey) return err('API Key 必填');
    await env.LINKS.put('config:ai', JSON.stringify({ apiKey: data.apiKey.trim() }));
    return ok({ message: 'AI 配置已保存' });
  }

  return err('未知 type');
}

export async function onRequestOptions() { return new Response(null, { status: 204 }); }
