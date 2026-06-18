# 🪐 Astro Friends Manager

> 专为 **Astro 框架 + vh-astro 主题** 打造的友链管理系统。  
> 基于 Cloudflare Pages，零成本运行。

[![GitHub stars](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2Fzlm6666%2Fastro-friends-manager&query=stargazers_count&style=flat-square&label=%E2%AD%90%20Stars&color=yellow)](https://github.com/zlm6666/astro-friends-manager)
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
| 🔍 `/check` | 查询审核状态 |
| 🔐 `/admin` | 审核、编辑、置顶、邮件/RSS/图床/AI 配置 |
| 🔗 `/api/links` | 已通过友链（标准格式） |
| 📡 `/api/rss` | 友链文章聚合 |

---

## 🔧 vh-astro 主题对接

在 Astro 项目配置中填入 API 地址：

```js
friendsApi: "https://你的域名/api/links"
```

---

## 🚀 小白部署指南（全程鼠标点，不用打命令）

> **你需要准备**：一个 GitHub 账号 + 一个 Cloudflare 账号（注册免费）

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zlm6666/astro-friends-manager)

### 第 1 步：把代码复制到你自己的 GitHub

1. 打开 [这个仓库](https://github.com/zlm6666/astro-friends-manager)
2. 点右上角 **Fork** 按钮（把代码复制到你自己的账号下）
3. 等几秒，完成后你名下会多出一个一模一样的仓库

> 如果你会用 Git，也可以 `git clone` 然后推到你自己的仓库，两种方式都可以。

### 第 2 步：在 Cloudflare 创建项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单点 **Workers 和 Pages**
3. 点 **创建** → **Pages** → **连接到 Git**
4. **授权 Cloudflare 访问你的 GitHub**（第一次用的话需要点一下授权）
5. 在弹出的仓库列表里找到你刚 Fork 的那个仓库，点 **设置并开始部署**
6. **构建设置** 保持默认就行，但检查一下：
   - **Framework preset** → 选 **无**
   - **构建命令** → 留空
   - **构建输出目录** → 填 **`public`**
7. 点 **保存并部署**
8. 等一两分钟，Cloudflare 会自动构建部署。完成后会给你一个地址：`xxxx-xxx.pages.dev`

### 第 3 步：绑定 KV 数据库（用来存数据）

> KV 是 Cloudflare 提供的一个免费数据库，用来存储友链记录、配置等。

1. 回到 Cloudflare Dashboard，左侧菜单点 **Workers 和 Pages** → **KV**
2. 点 **创建命名空间** → 名称填 **`friend-links`** → 点 **创建**
3. 回到 **Workers 和 Pages**，点你刚创建的那个 Pages 项目
4. 点顶部的 **Settings** 标签 → 左侧 **Functions** → **KV namespace bindings**
5. 点 **添加绑定**：
   - **变量名称** 填：**`LINKS`**（必须一模一样，大小写不能错）
   - **KV 命名空间** 选：**`friend-links`**（刚创建的那个）

### 第 4 步：配置环境变量

> 用来存一些密钥类的信息，不暴露在代码里。

1. 在同一个项目里，点 **Settings** → **Environment variables**
2. 点 **添加变量**：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `CRON_SECRET` | 随便打一串乱码，比如 `abc123xyz` | 用来保护 RSS 刷新接口 |

### 第 5 步：登录管理后台

1. 打开浏览器访问：`https://你的域名.pages.dev/admin`
2. 默认账号：**`admin`**，密码：**`123456`**
3. ⚠️ **首次登录会强制要求改密码**，改一个你自己记得住的
4. 登录成功后，你就能看到友链管理后台了

### 第 6 步（可选）：配置邮件通知

> 有人提交友链申请时，系统会发邮件通知你。用 Resend 服务，免费 100 封/天。

1. 注册 [Resend](https://resend.com)（邮箱验证即可，不用绑卡）
2. 登录 Resend → **Add domain** → 输入你的域名（比如 `yourdomain.com`）
3. 按提示在你的域名 DNS 里添加两条记录（Resend 会告诉你加什么）
4. 拿到 **API Key**（格式是 `re_xxxxx`）
5. 打开你的友链管理后台 → **邮件配置**
6. 填入：API Key、发件邮箱（验证过的那个）、收件邮箱（你自己的邮箱）
7. 点 **保存**，然后点 **发送测试邮件** 验证

> 💡 **收件邮箱可以用 QQ 邮箱**。如果收不到，去 Resend 后台检查域名 DKIM 是否验证成功，大概率是 DNS 记录没生效，等几分钟再试。

### 第 7 步（可选）：配置图床

> 审核通过友链时，系统会自动把对方的头像上传到 TuCang 图床，防止对方换图或图片挂了。

详细教程看这里 👉 [https://www.yuque.com/lazydoc/qlg37h/oyc0e8y8z99yi0m9](https://www.yuque.com/lazydoc/qlg37h/oyc0e8y8z99yi0m9)

### 第 8 步（可选）：配置 AI 一键导入

> 对方发来的友链数据格式不对时，DeepSeek AI 会自动帮你转成标准格式。

1. 注册 [DeepSeek](https://platform.deepseek.com) → **API 密钥** → **创建密钥**
2. 复制 Key（格式 `sk-xxxxx`）
3. 打开管理后台 → **AI 配置** → 粘贴 Key → 保存

> 不配也能用——标准的 YAML/JSON 格式（如 `name: xxx`）前端直接解析，不需要 AI。

### 第 9 步（可选）：配置定时刷新 RSS

> 系统每隔一段时间会自动抓取友链的最新文章。

由于 Cloudflare 不支持自动定时任务，需要一个免费的外部服务来触发：

1. 打开 [cron-job.org](https://cron-job.org) 注册
2. 点 **创建定时任务**
3. 按下面填：
   - **URL**：`https://你的域名.pages.dev/api/cron/refresh`
   - **Method**：选 **GET**
   - **Headers**：加一个 `X-Cron-Secret`，值填你第 4 步设的 `CRON_SECRET`
   - **Schedule**：选 **Every 4 hours**
4. 点 **创建**，搞定

> 这样每 4 小时系统会自动刷新 RSS，不需要你做任何操作。

### 第 10 步：绑定你自己的域名（推荐）

> 用 `xxx.pages.dev` 也能用，但绑定自己的域名更好看也更稳定。

1. Cloudflare Dashboard → **Workers 和 Pages** → 你的项目
2. 点 **自定义域** → **设置自定义域**
3. 输入你的域名（比如 `friends.yourdomain.com`）
4. Cloudflare 会自动配置 DNS，等一两分钟生效

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

## 📄 License

MIT
