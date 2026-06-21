// functions/api/_rss_core.js
// RSS 抓取 + 轮换 + 格式化核心逻辑
import { getList } from './_utils.js';

// UTC+8 (CST) 时间格式化
function toCST(ts) {
  const d = ts ? new Date(ts) : new Date();
  const cst = new Date(d.getTime() + 8 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  return `${cst.getUTCFullYear()}-${pad(cst.getUTCMonth()+1)}-${pad(cst.getUTCDate())}T${pad(cst.getUTCHours())}:${pad(cst.getUTCMinutes())}:${pad(cst.getUTCSeconds())}+08:00`;
}

// 默认源（申请友链无 RSS 时使用这些兜底）
const DEFAULT_FEEDS = [
  'https://blog.xiaow.qzz.io/rss.xml'
];

/**
 * 获取所有 RSS 源（已通过友链的 rss 字段 + 兜底默认源去重）
 */
export async function getAllFeeds(env) {
  const ids = await getList(env, 'link:list:approved');
  const feeds = new Set();
  // 用 BLOG_URL 替换默认源中的 hardcoded 域名
  if (env.BLOG_URL) {
    feeds.add(new URL('/rss.xml', env.BLOG_URL).href);
  }
  for (const id of ids) {
    const r = JSON.parse(await env.LINKS.get(`link:approved:${id}`) || 'null');
    if (r?.rss) feeds.add(r.rss.trim());
  }
  DEFAULT_FEEDS.forEach(f => feeds.add(f));
  return Array.from(feeds);
}

/**
 * 执行一次更新：取游标处 2 条，合并到现有 articles，去重排序取前 20
 */
export async function runRssUpdate(env) {
  const allFeeds = await getAllFeeds(env);
  if (allFeeds.length === 0) {
    await env.LINKS.put('rss:articles', JSON.stringify([]));
    return { updated: 0, total: 0, cursor: 0, feeds: [] };
  }

  // 读游标
  const cursor = parseInt(await env.LINKS.get('rss:cursor') || '0', 10);
  // 选：1/3 阶梯（最少2最多8）
  const nPer = Math.min(Math.max(2, Math.round(allFeeds.length / 3)), 8);
  const pick = [];
  for (let i = 0; i < nPer && i < allFeeds.length; i++) {
    const idx = (cursor + i) % allFeeds.length;
    pick.push(allFeeds[idx]);
  }
  // 推进游标
  const newCursor = (cursor + nPer) % allFeeds.length;

  // 读现有 articles
  const existing = JSON.parse(await env.LINKS.get('rss:articles') || '[]');

  // 抓取新选的两条
  const newArticles = [];
  for (const url of pick) {
    try {
      const feed = await fetchAndParse(url);
      if (feed.items?.length) {
        const sourceTitle = feed.title || '未知来源';
        feed.items.forEach(item => {
          newArticles.push({ ...item, sourceFeedTitle: sourceTitle });
        });
      }
    } catch (e) {
      console.error(`抓取失败 ${url}:`, e.message);
    }
  }

  // 合并 + 去重 + 排序 + 取前 20
  const merged = [...newArticles, ...existing];
  const unique = removeDuplicates(merged);
  const sorted = sortArticlesByDate(unique);
  const rssCfg = JSON.parse(await env.LINKS.get('config:rss') || '{}');
  const cacheSize = Math.max(5, Math.min(200, parseInt(rssCfg.cacheSize) || 20));
  const capped = sorted.slice(0, cacheSize);
  const formatted = capped.map(formatArticle);

  // 写回
  await env.LINKS.put('rss:articles', JSON.stringify(formatted));
  await env.LINKS.put('rss:cursor', String(newCursor));
  await env.LINKS.put('rss:lastUpdate', toCST());
  await env.LINKS.put('rss:feeds:current', JSON.stringify(pick));

  return {
    updated: pick.length,
    totalFeeds: allFeeds.length,
    cursor: newCursor,
    picked: pick,
    articleCount: formatted.length
  };
}

/**
 * 拉取并解析 RSS（支持 RSS 2.0 / Atom）
 */
async function fetchAndParse(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'RSS-Aggregator/1.0' },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const xml = await resp.text();
  return parseXmlFeed(xml, url);
}

/**
 * 简易 XML 解析（不依赖 rss-parser，因为 CF Workers 体积限制）
 * 支持 RSS 2.0 和 Atom
 */
function parseXmlFeed(xml, sourceUrl) {
  const isAtom = xml.includes('<feed');
  let feedTitle = '未知来源';
  const titleMatch = xml.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/i)
    || xml.match(/<feed[\s\S]*?<title>([\s\S]*?)<\/title>/i);
  if (titleMatch) feedTitle = stripTags(decodeEntities(titleMatch[1])).trim();

  const items = [];
  if (isAtom) {
    const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
    const entries = xml.match(entryRegex) || [];
    for (const e of entries) {
      const t = pickTag(e, 'title');
      const l = pickHref(e, 'link');
      const pub = pickTag(e, 'published') || pickTag(e, 'updated');
      const author = pickTag(e, 'author\\s*>[\\s\\S]*?<name>', 'name') || pickTag(e, 'name');
      const content = pickTag(e, 'content') || pickTag(e, 'summary');
      items.push({
        title: t, link: l, pubDate: pub, isoDate: pub, author, content
      });
    }
  } else {
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    const its = xml.match(itemRegex) || [];
    for (const it of its) {
      const t = pickTag(it, 'title');
      const l = pickTag(it, 'link');
      const pub = pickTag(it, 'pubDate') || pickTag(it, 'date');
      const author = pickTag(it, 'author') || pickTag(it, 'dc:creator');
      const content = pickTag(it, 'content:encoded') || pickTag(it, 'description');
      items.push({
        title: t, link: l, pubDate: pub, isoDate: pub, author, content
      });
    }
  }
  return { title: feedTitle, items, sourceUrl };
}

function pickTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? stripTags(decodeEntities(m[1])).trim() : '';
}

function pickHref(block, tag) {
  const re = new RegExp(`<${tag}[^>]*href=["']([^"']+)["']`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function removeDuplicates(articles) {
  const seen = new Set();
  return articles.filter(art => {
    const key = art.link || art.guid;
    return key && !seen.has(key) && (seen.add(key), true);
  });
}

function sortArticlesByDate(articles) {
  return articles.sort((a, b) => {
    const dateA = a.isoDate ? new Date(a.isoDate) : a.pubDate ? new Date(a.pubDate) : new Date(0);
    const dateB = b.isoDate ? new Date(b.isoDate) : b.pubDate ? new Date(b.pubDate) : new Date(0);
    return dateB - dateA;
  });
}

function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function cleanHtml(html) {
  return html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';
}

function cleanText(text) {
  return text?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() || '';
}

function formatArticle(article) {
  const date = article.isoDate ? new Date(article.isoDate)
    : article.pubDate ? new Date(article.pubDate) : new Date();
  const dateStr = formatDate(date);

  let auther = '未知作者';
  if (article.author) auther = article.author;
  else if (article.auther) auther = article.auther;        // 兼容已格式化的旧文章
  else if (typeof article.source === 'string') auther = article.source;
  else if (article.sourceFeedTitle) auther = article.sourceFeedTitle;
  auther = cleanText(auther).substring(0, 50);

  let content = article['content:encoded'] || article.content
    || article.contentSnippet || article.description || article.summary || '';
  const cleanContent = cleanHtml(content).substring(0, 200);

  return {
    title: cleanText(article.title || '无标题'),
    auther,
    date: dateStr,
    isoDate: toCST(date),
    link: article.link || '',
    content: cleanContent,
    sourceFeedTitle: article.sourceFeedTitle || auther      // 保留，供下次合并重新入库时用
  };
}
