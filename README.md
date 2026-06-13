# 友链管理系统

基于 Cloudflare Pages + Workers Functions + KV 的友情链接申请管理系统。

## ✨ 功能

- 📝 **申请页**（`/`）：表单提交，必填标题/头像/链接/描述，可选 RSS，必须勾选 7 条条款
- 🔍 **查询页**（`/cheak`）：输入标题或链接，实时查询审核状态（待审/通过/拒绝）
- 🔐 **管理后台**（`/admin`）：默认账号 `admin` / `123456`，首次登录强制改密
  - 审核：通过 / 拒绝 / 删除
  - 邮件配置：Resend API + QQ 邮箱（通过 Resend SMTP 凭据）
  - 图床配置：审核通过后自动上传到 TuCang 图床
  - RSS 状态：游标/上次更新时间/手动触发
  - 修改密码
- 📡 **RSS 聚合 API**（`/api/rss`）：从已通过友链的 RSS 源轮换拉取，前端直接读 KV 缓存
- 🔗 **友链列表 API**（`/api/links`）：返回已通过友链的标准化 JSON

## 🗂️ 项目结构

```
friend-link-system/
├── public/                       # 静态资源（Pages 构建输出）
│   ├── index.html                # 申请页
│   ├── cheak.html                # 查询页
│   └── admin.html                # 管理后台
├── functions/
│   └── api/
│       ├── _utils.js             # 通用工具
│       ├── _rss_core.js          # RSS 抓取 + 轮换核心
│       ├── submit.js             # POST /api/submit
│       ├── status.js             # GET  /api/status
│       ├── links.js              # GET  /api/links
│       ├── rss.js                # GET  /api/rss
│       ├── cron/refresh.js       # POST /api/cron/refresh（定时任务入口）
│       └── admin/
│           ├── login.js          # POST /api/admin/login
│           ├── logout.js         # POST /api/admin/logout
│           ├── change-password.js
│           ├── list.js           # GET  /api/admin/list
│           ├── review.js         # POST /api/admin/review
│           ├── config.js         # GET/POST /api/admin/config
│           ├── test-email.js
│           ├── refresh-rss.js
│           └── rss-status.js
├── wrangler.toml
└── README.md
```

## 🚀 部署步骤

### 1. 推到 GitHub

```bash
cd friend-link-system
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/friend-link-system.git
git push -u origin main
```

### 2. Cloudflare Dashboard 创建 Pages 项目

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择你的仓库
3. **Build settings**：
   - Framework preset: **None**
   - Build command: 留空
   - Build output directory: `public`
4. 点 Save and Deploy

### 3. 绑定 KV 命名空间

1. **创建 KV**：Workers & Pages → **KV** → **Create a namespace** → 命名 `friend-links`
2. **绑定到 Pages**：Pages 项目 → **Settings** → **Functions** → **KV namespace bindings** → **Add binding**
   - Variable name: `LINKS`
   - KV namespace: `friend-links`

### 4. 设置环境变量

Pages 项目 → **Settings** → **Environment variables** → 添加：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `CRON_SECRET` | ✅ | 任意随机字符串，用于 `/api/cron/refresh` 鉴权 |
| `TUCANG_TOKEN` | 可选 | TuCang 图床 token（不设则用 KV 配置或内置默认值） |
| `TUCANG_FOLDER_ID` | 可选 | TuCang 图床文件夹 ID |

### 5. 配置定时刷新 RSS

Cloudflare Pages Functions **不支持** Cron Triggers（只有单独部署的 Workers 支持），所以用外部 cron：

- 推荐 [cron-job.org](https://cron-job.org/)（免费、无需信用卡）
- 创建任务：
  - URL: `https://你的域名.pages.dev/api/cron/refresh`
  - Method: `POST`（或 GET）
  - Headers: `X-Cron-Secret: 你的CRON_SECRET值`
  - 执行频率：每 30 分钟

### 6. 登录管理后台

访问 `https://你的域名.pages.dev/admin`，用 `admin` / `123456` 登录。

⚠️ 首次登录会强制要求改密！

### 7. 配置邮件服务

使用 **MailChannels**（CF 官方合作，免费 3000 封/月，无需注册）。

**前置条件**：在你的域名 DNS 添加 SPF 记录：

| 类型 | 名称 | 内容 |
|------|------|------|
| TXT  | @    | `v=spf1 include:relay.mailchannels.net ~all` |

> 如果你用 Cloudflare DNS：Dashboard → 域名 → DNS → 添加记录，60 秒生效。

然后登录管理后台 → **邮件配置**，填入：
- **发件邮箱**：`noreply@你的域名.com`
- **收件邮箱**：你的 QQ 邮箱 / Gmail / 任何邮箱
- 点 **发送测试邮件** 验证

### 8. 配置图床

在管理后台 → **图床配置**：
- Token：你在 TuCang 平台获取的 token
- Folder ID：目标文件夹 ID

> Token 存在 KV 里，不会暴露在代码中。

### ⚠️ 常见问题：KV 绑定和环境变量被"吞"

Cloudflare Pages 的 **Production** 和 **Preview** 部署配置是独立的。每次 push 代码后自动创建的是 Preview 部署，但你可能只配了 Production：

```
Settings → Functions → KV namespace bindings
  ↳ 先切到 Preview → 再绑定一次 LINKS

Settings → Environment variables
  ↳ 先切到 Preview → 再配一次 CRON_SECRET
```

两个环境都配好就不会吞了。

## 📡 API 文档

### `GET /api/links`

返回已通过友链（标准化格式）：
```json
[
  {
    "name": "笑的主页",
    "link": "https://xiaow.qzz.io",
    "avatar": "https://wp-cdn.4ce.cn/v2/TVFIv5x.jpeg",
    "descr": "看看我都干了些啥？"
  }
]
```

### `GET /api/rss`

返回聚合后的最新 20 篇文章：
```json
[
  {
    "title": "文章标题",
    "auther": "来源博客名",
    "date": "2026-06-14",
    "link": "https://...",
    "content": "文章摘要..."
  }
]
```

### `GET /api/status?q=关键词`

查询申请状态（按标题或链接模糊匹配）。

### `POST /api/submit`

提交申请（公开）：
```json
{
  "title": "网站标题",
  "avatar": "https://...",
  "link": "https://...",
  "descr": "描述",
  "rss": "https://.../rss.xml",
  "agreed": true
}
```

## 🔄 RSS 轮换机制

- 数据源：从 `link:list:approved` 中所有记录的 `rss` 字段 + 默认 6 个兜底源
- 触发：cron-job.org 每 30 分钟调用 `/api/cron/refresh`
- 行为：每次选游标处 **2 条** RSS 源抓取，与现有文章合并去重，按时间倒序取前 20
- 存储：写入 KV `rss:articles`，API 直接读
- 游标：循环推进（0 → 2 → 4 → ... → 末尾回 0）

## 🛠️ 本地开发

```bash
# 安装 wrangler
npm install -g wrangler

# 本地预览（含 Functions）
wrangler pages dev ./public

# 模拟 KV（在 Dashboard 拿一个测试命名空间 ID）
wrangler pages dev ./public --kv LINKS=<KV_ID> --binding CRON_SECRET=test
```

## 📝 License

MIT
