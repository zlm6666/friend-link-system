# 🌐 友链管理系统

> 一个开源的友情链接申请、审核、管理系统，基于 Cloudflare Pages 搭建，**零成本运行**。

[![GitHub stars](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2Fzlm6666%2Ffriend-link-system&query=stargazers_count&style=flat-square&label=%E2%AD%90%20Stars&color=yellow)](https://github.com/zlm6666/friend-link-system)
[![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Deploy with Cloudflare](https://img.shields.io/badge/Deploy%20with-Cloudflare-f38020?style=flat-square&logo=cloudflare)](https://dash.cloudflare.com/)

---

## ✨ 它能做什么？

| 页面 | 功能 | 谁在用 |
|------|------|--------|
| 🏠 **首页 `/`** | 访客提交友链申请（表单+一键导入YAML/JSON/AI兜底） | 你的朋友/博客访客 |
| 🔍 **查询页 `/cheak`** | 输入名称或链接，查看审核结果 | 申请者自己 |
| 🔐 **管理后台 `/admin`** | 审核、编辑、置顶、配置邮件/图床/RSS | **你** |
| 🔗 **`/api/links`** | 返回你已通过的友链（标准 JSON 格式） | 你的博客前端 |
| 🎯 **`/api/links-qexo`** | 返回 Qexo 兼容格式的友链数据 | Qexo 用户 |
| 📡 **`/api/rss`** | 聚合友链的最新文章（前 20 条） | RSS 阅读器/你的博客 |

---

## 🚀 小白部署指南（全程鼠标点，不用打命令）

> **你需要准备**：一个 GitHub 账号 + 一个 Cloudflare 账号（注册免费）

### 第 1 步：把代码复制到你自己的 GitHub

1. 打开 [这个仓库](https://github.com/zlm6666/friend-link-system)
2. 点右上角 **Fork** 按钮（把代码复制到你自己的账号下）
3. 等几秒，完成后你名下会多出一个一模一样的仓库

> 如果你会用 Git，也可以 `git clone` 然后推到你自己的仓库，两种方式都可以。

### 第 2 步：在 Cloudflare 创建项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单点 **Workers & Pages**
3. 点 **Create** → **Pages** → **Connect to Git**
4. **授权 Cloudflare 访问你的 GitHub**（第一次用的话需要点一下授权）
5. 在弹出的仓库列表里找到你刚 Fork 的那个仓库，点 **Begin setup**
6. **Build settings** 保持默认就行，但检查一下：
   - **Framework preset** → 选 **None**
   - **Build command** → 留空
   - **Build output directory** → 填 **`public`**
7. 点 **Save and Deploy**
8. 等一两分钟，Cloudflare 会自动构建部署。完成后会给你一个地址：`xxxx-xxx.pages.dev`

### 第 3 步：绑定 KV 数据库（用来存数据）

> KV 是 Cloudflare 提供的一个免费数据库，用来存储友链记录、配置等。

1. 回到 Cloudflare Dashboard，左侧菜单点 **Workers & Pages** → **KV**
2. 点 **Create a namespace** → 名称填 **`friend-links`** → 点 **Create**
3. 回到 **Workers & Pages**，点你刚创建的那个 Pages 项目
4. 点顶部的 **Settings** 标签 → 左侧 **Functions** → **KV namespace bindings**
5. 点 **Add binding**：
   - **Variable name** 填：**`LINKS`**（必须一模一样，大小写不能错）
   - **KV namespace** 选：**`friend-links`**（刚创建的那个）
6. 🔴 **注意**：上面有个下拉框可以选 `Production` 还是 `Preview`，**两个都要各绑定一次**，不然部署新版本后配置会丢

### 第 4 步：配置环境变量

> 用来存一些密钥类的信息，不暴露在代码里。

1. 在同一个项目里，点 **Settings** → **Environment variables**
2. 点 **Add variable**：
   | 变量名 | 值 | 说明 |
   |--------|-----|------|
   | `CRON_SECRET` | 随便打一串乱码，比如 `abc123xyz` | 用来保护你的 RSS 刷新接口 |
3. 🔴 **同样**：`Production` 和 `Preview` 各配一次

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

1. 注册 [DeepSeek](https://platform.deepseek.com) → **API Keys** → **Create API Key**
2. 复制 Key（格式 `sk-xxxxx`）
3. 打开管理后台 → **AI 配置** → 粘贴 Key → 保存

> 不配也能用——标准的 YAML/JSON 格式（如 `name: xxx`）前端直接解析，不需要 AI。

### 第 9 步（可选）：配置定时刷新 RSS

> 系统每隔一段时间会自动抓取友链的最新文章。

由于 Cloudflare 不支持自动定时任务，需要一个免费的外部服务来触发：

1. 打开 [cron-job.org](https://cron-job.org) 注册
2. 点 **Create Cronjob**
3. 按下面填：
   - **URL**：`https://你的域名.pages.dev/api/cron/refresh`
   - **Method**：选 **GET**
   - **Headers**：加一个 `X-Cron-Secret`，值填你第 4 步设的 `CRON_SECRET`
   - **Schedule**：选 **Every 4 hours**
4. 点 **Create**，搞定

> 这样每 4 小时系统会自动刷新 RSS，不需要你做任何操作。

### 第 10 步：绑定你自己的域名（推荐）

> 用 `xxx.pages.dev` 也能用，但绑定自己的域名更好看也更稳定。

1. Cloudflare Dashboard → **Workers & Pages** → 你的项目
2. 点 **Custom domains** → **Set up a custom domain**
3. 输入你的域名（比如 `friends.yourdomain.com`）
4. Cloudflare 会自动配置 DNS，等一两分钟生效

---

## 🖥️ 页面一览

### 申请页 `/`
- **普通表单**：手动填写标题、头像、链接、描述、RSS
- **一键导入 ✨**：展开后粘贴对方发来的友链数据（YAML/JSON 均支持），点"解析填入"自动填写表单
- **AI 解析兜底**：格式不规范时点"AI 解析"，DeepSeek 自动转成标准格式填入

### 查询页 `/cheak`
输入你的网站名称或链接，就能看到审核状态：⏳ 待审 / ✅ 已通过 / ❌ 已拒绝

### 管理后台 `/admin`
所有管理操作都在这里：

| 功能 | 说明 |
|------|------|
| 📋 待审核 | 新申请列表，点"通过"或"拒绝" |
| ✅ 已通过 | 已通过的友链，可以编辑、置顶、删除 |
| ❌ 已拒绝 | 被拒绝的申请记录 |
| 📡 RSS 状态 | 查看当前聚合进度，手动触发刷新 |
| ✉️ 邮件配置 | 配置发件信息 |
| 🖼️ 图床配置 | 配置头像自动上传 |
| 🤖 AI 配置 | 配置 DeepSeek API Key，用于一键导入 AI 兜底 |
| 🔑 修改密码 | 改密码 |

---

## 📡 API 接口（给开发者用的）

### `GET /api/links`

返回你所有已通过的友链：
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

### `GET /api/links-qexo`

返回 Qexo 兼容格式（Qexo 用户用这个）：
```json
{
  "data": [
    {
      "name": "笑的主页",
      "url": "https://xiaow.qzz.io",
      "image": "https://wp-cdn.4ce.cn/v2/TVFIv5x.jpeg",
      "description": "看看我都干了些啥？"
    }
  ],
  "status": true
}
```

前端调用脚本：
```javascript
function loadQexoFriends(id, url) {
  var uri = url + "/api/links-qexo";
  // ...（其余代码不变，只用改上面这行路径）
}
loadQexoFriends("friends", "https://你的域名.pages.dev");
```

### `GET /api/rss`

返回聚合的最新 20 篇文章：
```json
[
  {
    "title": "文章标题",
    "auther": "来源博客",
    "date": "2026-06-14",
    "link": "https://...",
    "content": "文章摘要"
  }
]
```

### `GET /api/status?q=网站名称`
查询友链申请状态。

### `POST /api/submit`
提交友链申请（被申请页调用的，一般不需要手动调）。

---

## ❓ 常见问题

### Q：KV 绑定配置好了，过一会儿又没了？
Cloudflare 的 **Production** 和 **Preview** 是两套独立配置。你配了 Production 但没配 Preview。去 Settings 里两个环境都配一次就好。

### Q：登录后 F5 刷新又回到登录页？
部署新版本后需要等一两分钟让 Cloudflare 完成构建。如果一直这样，浏览器硬刷新一下（Ctrl+Shift+R）。

### Q：测试邮件发送失败？
1. 检查 Resend API Key 是否正确
2. 检查发件邮箱的域名是否在 Resend 验证完成
3. 去 Resend 后台看有没有错误日志

### Q：提交友链申请后没收到邮件通知？
先确认管理后台的邮件配置保存成功并测试通过。如果测试通过但申请不通知，检查 `CRON_SECRET` 环境变量是否配置正确。

### Q：部署失败怎么办？
去 Cloudflare Dashboard → 你的 Pages 项目 → **Deployments**，点开最新那条失败的记录看日志。常见原因是 Functions 代码有语法错误——可以提 Issue 告诉我。

---

## 📄 License

[MIT](LICENSE) — 随便用，随便改，保留原作者信息即可。

## ⭐ 支持一下

如果这个项目帮到了你，点个 Star ⭐ 就是最大的支持！

有问题或建议 → [提 Issue](https://github.com/zlm6666/friend-link-system/issues)
