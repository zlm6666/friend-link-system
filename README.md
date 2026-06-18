# 🪐 Astro Friends Manager

> 专为 **Astro 框架 + vh-astro 主题** 打造的友链管理系统。  
> 基于 Cloudflare Pages，零成本运行。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zlm6666/astro-friends-manager)
[![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## 🎯 为什么用这个？

vh-astro 主题通过 API 拉取友链，系统提供标准 JSON 接口：

```
GET /api/links
```

```json
[
  {
    "name": "笑的博客",
    "link": "https://www.xiaow.qzz.io",
    "avatar": "https://wp-cdn.4ce.cn/v2/xxx.jpeg",
    "descr": "随性收拢生活散落的笑意"
  }
]
```

> 额外附带 Qexo 兼容格式 `/api/links-qexo` 和 `/pub/friends`，供其他平台使用。

---

## ✨ 功能一览

| 页面 | 功能 |
|------|------|
| 🏠 `/` | 访客提交友链（表单 + 一键导入 YAML/JSON） |
| 🔍 `/cheak` | 查询审核状态 |
| 🔐 `/admin` | 审核、编辑、置顶、邮件/RSS/图床/AI 配置 |
| 🔗 `/api/links` | 已通过友链（标准格式） |
| 📡 `/api/rss` | 友链文章聚合 |

---

## 🚀 一键部署

点击上面的 **Deploy to Cloudflare** 按钮，授权 GitHub 后自动创建项目。

> 如果按钮打不开，手动步骤👇

### 手动部署

1. Fork 本仓库
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → Connect to Git
3. 选你 Fork 的仓库，Build settings：
   - Framework preset: **None**
   - Build command: 留空
   - Output directory: **`public`**
4. Deploy

### 必须配 KV

1. Cloudflare → Workers & Pages → KV → 创建命名空间 `friend-links`
2. 回到 Pages 项目 → Settings → Functions → KV bindings
3. 变量名: **`LINKS`**，选 `friend-links`

### 环境变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `CRON_SECRET` | 随意乱码 | 保护定时任务 |

---

## 🔧 vh-astro 主题对接

在 Astro 项目配置中填入 API 地址：

```js
// 友链数据源
friendsApi: "https://你的域名/api/links"
```

---

## 📡 API 文档

### 公开接口

#### `GET /api/links`

返回所有已通过友链，标准 JSON 数组：

```json
[
  {
    "name": "笑的博客",
    "link": "https://www.xiaow.qzz.io",
    "avatar": "https://wp-cdn.4ce.cn/v2/TVFIv5x.jpeg",
    "descr": "随性收拢生活散落的笑意",
    "rss": "https://blog.xiaow.qzz.io/rss.xml"
  }
]
```

#### `GET /api/links-qexo`

Qexo 兼容格式：

```json
{
  "data": [ { "name": "...", "link": "...", "avatar": "...", "descr": "..." } ],
  "status": true
}
```

> 短路径别名：`/pub/friends`

#### `GET /api/status?q=关键词`

查询申请状态，返回匹配的记录及审核结果。

```json
{
  "items": [
    {
      "record": { "title": "笑的博客", "link": "...", ... },
      "status": "approved"
    }
  ]
}
```

#### `GET /api/rss`

友链文章聚合 Feed，返回缓存的最新文章（默认 20 篇，可在后台调整）。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>友链文章聚合</title>
    <item>
      <title>文章标题</title>
      <link>https://...</link>
      <description>摘要...</description>
      <pubDate>Wed, 18 Jun 2026 12:00:00 +0800</pubDate>
    </item>
  </channel>
</rss>
```

#### `POST /api/submit`

提交友链申请：

```json
{
  "title": "笑的博客",
  "link": "https://www.xiaow.qzz.io",
  "avatar": "https://...",
  "descr": "随性收拢生活散落的笑意",
  "rss": "https://blog.xiaow.qzz.io/rss.xml",
  "email": "me@example.com",
  "remark": "备注"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 站点名称，最长 50 字 |
| `link` | ✅ | 站点链接 |
| `avatar` | ✅ | 头像 URL |
| `descr` | ✅ | 站点描述，最长 200 字 |
| `rss` | ❌ | RSS 订阅地址 |
| `email` | ❌ | 接收审核结果通知 |
| `remark` | ❌ | 备注说明 |

返回：

```json
{ "ok": true, "data": { "id": "abc123" } }
```

### 管理接口（需登录）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/login` | POST | `{ "username", "password" }` → token |
| `/api/admin/list?status=pending` | GET | 按状态列出友链 |
| `/api/admin/review` | POST | 审核（通过/拒绝/置顶/删除/改状态） |
| `/api/admin/config` | GET/POST | 读取/保存配置 |
| `/api/admin/test-email` | POST | 发送测试邮件 |
| `/api/admin/backup` | GET | 导出全部数据 |
| `/api/admin/refresh-rss` | POST | 手动刷新 RSS |

---

## 📧 邮件通知（可选）

后台配置 SMTP 或 Resend，有人提交申请时发邮件通知管理员。

---

## 🖼️ 图床（可选）

审核通过时自动上传头像到 TuCang，防止对方换图。

---

## 📡 RSS 定时刷新

用 [cron-job.org](https://cron-job.org) 免费触发：
- URL: `https://你的域名/api/cron/refresh`
- Header: `X-Cron-Secret: 你设的 CRON_SECRET`
- 建议每 4 小时一次

RSS 缓存数量可在后台设置（默认 20 篇）。

---

## 📄 License

MIT
