// functions/api/admin/ai-convert.js
// 调用 DeepSeek 将非标准文本转换为友链结构数据
import { ok, err, requireAdmin } from '../_utils.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const SYSTEM_PROMPT = `你是一个严格的数据提取工具。从用户提供的文字中提取友链信息。

只返回一个 JSON 对象，格式：{"title":"网站名","avatar":"头像URL","link":"网站URL","descr":"描述","rss":"RSS地址"}

规则：
1. 只返回 JSON，不加任何其他文字、注释、代码块标记
2. 无法提取的字段设为空字符串（不要推测填充）
3. 如果用户输入根本不是友链信息（没有网站名称和网址），返回 {"error":"无法识别"}
4. title 不超过50字，descr 不超过200字
5. 链接必须是完整 URL（http/https 开头）`;

let keyIdCounter = 0;

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return err(auth.reason, 401);

  let body;
  try { body = await request.json(); } catch { return err('请求体不是 JSON'); }
  const { text } = body;
  if (!text || !text.trim()) return err('请输入文本');

  // 前置校验：输入太短或明显不是友链信息，不浪费 API token
  const t = text.trim();
  if (t.length < 8) return err('信息太短了，请提供网站名称和网址', 422);
  // 检查是否包含基本网站特征（域名或网址）
  if (!t.includes('.') && !t.includes('://') && !t.includes('。')) {
    return err('未识别到友链信息，请提供网站名称和网址', 422);
  }

  const apiKey = await getKey(env);
  if (!apiKey) return err('DeepSeek API Key 未配置（管理后台 AI 配置或环境变量 DEEPSEEK_KEY）');

  const reqId = ++keyIdCounter;
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: t }
        ],
        temperature: 0,
        max_tokens: 500,
        stream: false
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ai-convert#${reqId}] DeepSeek ${resp.status}:`, errText);
      if (resp.status === 401) return err('DeepSeek API Key 无效', 502);
      if (resp.status === 429) return err('DeepSeek 请求频繁，稍后重试', 429);
      return err(`DeepSeek 返回错误 (${resp.status})`, 502);
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return err('DeepSeek 返回为空', 502);

    // 解析 AI 返回的 JSON
    let parsed;
    try {
      const cleaned = content.replace(/```(?:json)?\s*|\s*```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(`[ai-convert#${reqId}] 解析失败:`, content);
      return err('AI 返回格式异常，请换种方式描述后重试', 422);
    }

    // 如果 AI 返回了 error，说明输入无法识别
    if (parsed.error) return err('无法识别，请提供更完整的友链信息（网站名、网址等）', 422);

    // 信息不全时，能填的填上，缺的留空
    return ok({
      title: String(parsed.title || '').substring(0, 50),
      avatar: String(parsed.avatar || ''),
      link: String(parsed.link || ''),
      descr: String(parsed.descr || '').substring(0, 200),
      rss: String(parsed.rss || '')
    });
  } catch (e) {
    console.error(`[ai-convert#${reqId}] 异常:`, e.message);
    return err('AI 解析失败: ' + e.message, 500);
  }
}

async function getKey(env) {
  const raw = await env.LINKS.get('config:ai');
  if (raw) {
    try {
      const cfg = JSON.parse(raw);
      if (cfg.apiKey) return cfg.apiKey;
    } catch {}
  }
  return env.DEEPSEEK_KEY || '';
}

export async function onRequestOptions() { return new Response(null, { status: 204 }); }
