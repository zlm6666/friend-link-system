// functions/api/admin/config.js
// 邮件配置（Resend）+ 图床配置 + AI 配置
import { ok, err, requireAdmin } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);
  const email = JSON.parse(await env.LINKS.get('config:email') || 'null');
  const tuCang = JSON.parse(await env.LINKS.get('config:tuCang') || 'null');
  const ai = JSON.parse(await env.LINKS.get('config:ai') || 'null');
  const smtp = JSON.parse(await env.LINKS.get('config:smtp') || 'null');
  const rss = JSON.parse(await env.LINKS.get('config:rss') || 'null');
  const safe = (obj) => obj ? {
    ...obj,
    apiKey: obj.apiKey ? '******' : '',
    token: obj.token ? '******' : '',
    password: obj.password ? '******' : ''
  } : null;
  const username = await env.LINKS.get('config:username') || 'admin';
  return ok({
    email: safe(email),
    tuCang: safe(tuCang),
    ai: safe(ai),
    smtp: safe(smtp),
    username,
    rss: rss || { cacheSize: 20 }
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
    // SMTP 模式不需要 apiKey 和 from（走自己的 SMTP 配置）
    if (data.provider !== 'smtp' && (!data.apiKey || !data.from)) return err('apiKey、from 必填');
    if (!data.to) return err('to 必填');
    await env.LINKS.put('config:email', JSON.stringify({
      provider: data.provider || 'resend',
      apiKey: data.apiKey.trim(),
      from: data.from.trim(),
      fromName: (data.fromName || '').trim(),
      to: data.to.trim(),
      notifyMode: data.notifyMode || 'every'
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

  if (type === 'smtp') {
    if (data.password === '******') {
      const old = JSON.parse(await env.LINKS.get('config:smtp') || '{}');
      data.password = old.password || '';
    }
    if (!data.host || !data.port || !data.user || !data.password || !data.from || !data.to) return err('host、port、user、password、from、to 必填');
    await env.LINKS.put('config:smtp', JSON.stringify({
      host: data.host.trim(),
      port: parseInt(data.port) || 465,
      user: data.user.trim(),
      password: data.password.trim(),
      from: data.from.trim(),
      fromName: (data.fromName || '').trim(),
      to: data.to.trim(),
      asyncSmtp: !!data.asyncSmtp
    }));
    return ok({ message: 'SMTP 配置已保存' });
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

  if (type === 'username') {
    if (!data.username || !data.username.trim()) return err('用户名不能为空');
    await env.LINKS.put('config:username', data.username.trim());
    // 同步更新 config:admin 里的 user 字段，不然登录还是老用户名
    const adminRaw = JSON.parse(await env.LINKS.get('config:admin') || '{}');
    if (adminRaw.user) {
      adminRaw.user = data.username.trim();
      await env.LINKS.put('config:admin', JSON.stringify(adminRaw));
    }
    return ok({ message: '用户名已更新' });
  }

  if (type === 'rss') {
    const cacheSize = Math.max(5, Math.min(200, parseInt(data.cacheSize) || 20));
    await env.LINKS.put('config:rss', JSON.stringify({ cacheSize }));
    return ok({ message: 'RSS 配置已保存' });
  }

  return err('未知 type');
}

export async function onRequestOptions() { return new Response(null, { status: 204 }); }
