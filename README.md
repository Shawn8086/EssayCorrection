# 小笔杆 · 小学作文智能批改

面向小学一至六年级的作文批改网页应用。调用 DeepSeek 接口，一次生成 **五维评分、教师评语、错别字改正、句子升级、优秀段落赏析、结构建议和原文批注**。

> 内置任何 API Key 都需要你自己配置。网页支持临时填写，也可以写在服务端 `.env` 中。

## 功能

- **五维评分**：内容立意 30、结构条理 20、语言表达 30、字词标点 10、创意亮点 10，总分 100。分数由服务端重新累加校验，避免模型总分与维度分不一致。
- **教师评语**：先肯定具体优点，再给 3 条可执行建议，附“写给孩子的话”。
- **错别字改正**：逐条给出错字/错词/标点、正确写法、原文语境和原因；服务端会过滤掉原文中不存在的“错字”。
- **优秀段落**：从原文逐字摘录佳段，说明写法与好在哪里。
- **句子升级**：最多 3 处原句对照修改，保持小学生口吻。
- **原文批注**：在原文中高亮错字与佳段，修改建议直接标在行间。
- **按年级调整标准**：一、二年级重兴趣和句子完整；三、四年级重条理和具体；五、六年级重立意、详略与语言。
- **网页体验**：响应式布局、流式进度、取消批改、草稿本地保存、打印/另存 PDF、一键复制评语。
- **隐私**：作文不落库；临时 API Key 只存于当前标签页的 `sessionStorage`。本地/后端模式由服务端转发，纯静态模式由浏览器直接发给 DeepSeek。

## 快速开始

要求：Node.js 20 及以上（本项目在 Node 24 下开发，无需安装第三方依赖）。

```powershell
cd C:\Users\wangshaojie\Documents\deepseek-harness\default-workspace
npm start
```

也可以直接双击 `start-windows.bat`，它会启动服务并自动打开浏览器。

打开 <http://127.0.0.1:8787>。

首次使用有两种配置 Key 的方式：

### 方式一：网页临时填写（最快）

1. 点击右上角 **设置**；
2. 填入 DeepSeek API Key（`sk-` 开头）；
3. 保存后即可批改。

Key 只保存在当前浏览器标签页的 `sessionStorage` 中，关闭标签页即清除。请求会通过本机 Node 服务转发给 DeepSeek，不会写入服务器日志。

### 方式二：写入 `.env`（适合长期使用）

```powershell
Copy-Item .env.example .env
notepad .env
```

填写：

```dotenv
DEEPSEEK_API_KEY=sk-你的密钥
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
HOST=127.0.0.1
PORT=8787
```

保存后重启 `npm start`。服务端 Key 不会下发到浏览器。

### 局域网访问

把 `.env` 中的 `HOST` 改为 `0.0.0.0`，重启服务，然后让同一局域网内的设备访问：

```text
http://你的电脑IP:8787
```

如仍无法访问，请检查 Windows 防火墙是否放行了 8787 端口。不要把带 Key 的服务直接暴露到公网。

## 部署到 GitHub Pages

GitHub Pages 只能托管静态文件，**不能运行 `server.mjs`**。本项目已经做了两种适配：

1. **纯静态模式（最简单，推荐个人使用）**：页面直接调用 DeepSeek，每位访问者填写自己的 Key；
2. **Pages 前端 + 独立后端（适合分享给不会申请 Key 的人）**：后端继续用 `server.mjs`，Key 保存在服务端。

### 方案 A：纯静态部署（只使用 GitHub Pages）

这个方案不需要服务器，也不需要购买任何服务。DeepSeek 官方接口支持浏览器 CORS，页面会自动切换到“浏览器直连”模式。

#### 1. 创建 GitHub 仓库并推送

在 GitHub 新建一个 **Public** 仓库（免费账号的 Pages 需要公开仓库），然后在本项目目录执行：

```powershell
git init
git add .
git commit -m "feat: 小笔杆小学作文智能批改"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

`.env` 已被 `.gitignore` 忽略，不会把 Key 提交上去。

#### 2. 开启 Pages

打开 GitHub 仓库：

1. **Settings → Pages**；
2. **Build and deployment → Source** 选择 **GitHub Actions**；
3. 打开 **Actions** 标签，等待 `Deploy 小笔杆 to GitHub Pages` 工作流完成；
4. 页面地址通常是：

```text
https://<你的用户名>.github.io/<仓库名>/
```

仓库名为 `<用户名>.github.io` 时，地址是 `https://<用户名>.github.io/`。

工作流文件是 `.github/workflows/pages.yml`，它只发布 `public/` 目录，不会把服务端代码发到 Pages。

#### 3. 打开网页并填写 Key

首次打开会显示“待配置 Key”：

1. 点击右上角 **设置**；
2. 填入自己的 DeepSeek API Key；
3. 保存后即可批改。

静态模式下：

- Key 只保存在当前标签页的 `sessionStorage`；
- 浏览器直接请求 `https://api.deepseek.com`，不经过你的服务器；
- 关闭标签页后 Key 清除；
- 每个访问者需要自己的 Key，适合个人使用或小范围分享。

> **不要**把 API Key 写进 `runtime-config.js`、`app.js` 或任何会提交到 GitHub 的文件。公开仓库里的 Key 等于已经泄露。

#### 自定义域名（可选）

在 **Settings → Pages → Custom domain** 填写域名。使用 GitHub Actions 部署时，需要在 `public/` 下新增 `CNAME` 文件（内容为你的域名），再提交推送。

### 方案 B：Pages 前端 + 独立后端（访客无需填写 Key）

如果希望访问者打开就能用，需要把 `server.mjs` 部署到 Render、Railway、Fly.io 等 Node 托管平台，让 Pages 只做前端。

#### 1. 部署后端

仓库里的 `render.yaml` 可以作为 Render Blueprint 使用：

1. 注册 <https://render.com>，选择 **New → Blueprint**；
2. 连接同一个 GitHub 仓库；
3. 按提示填写环境变量：
   - `DEEPSEEK_API_KEY`：你的 DeepSeek Key；
   - `ALLOWED_ORIGINS`：你的 Pages 来源，例如 `https://yourname.github.io`（末尾不要加 `/`）；
4. 部署完成后记下后端地址，例如 `https://xiaobigan-api.onrender.com`。

也可以部署到 Railway、Fly.io 或自己的服务器，只要：

- 启动命令是 `npm start`；
- `HOST=0.0.0.0`；
- 平台提供的 `PORT` 能传入；
- 配置 `DEEPSEEK_API_KEY` 和 `ALLOWED_ORIGINS`。

#### 2. 让 Pages 指向后端

编辑 `public/runtime-config.js`：

```js
window.XBG_CONFIG = {
  apiBase: 'https://xiaobigan-api.onrender.com',
  directApiBase: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  directFallback: false
};
```

提交并推送：

```powershell
git add public/runtime-config.js
git commit -m "chore: point frontend to backend"
git push
```

Actions 会重新部署 Pages。此时网页会调用后端 `/api/config` 和 `/api/grade`，访客不需要填写 Key。

#### 后端 CORS 说明

`server.mjs` 已支持：

- `OPTIONS /api/*` 预检；
- `ALLOWED_ORIGINS` 白名单；
- `Access-Control-Allow-Headers: Content-Type, X-DeepSeek-Key`；
- SSE 流式响应同样带 CORS 头。

如果浏览器报 CORS 错误，检查：

1. `ALLOWED_ORIGINS` 是否与 Pages 地址完全一致（协议、域名都要对，末尾不要斜杠）；
2. 修改环境变量后是否重启了后端；
3. 是否误把 Pages 地址写成了仓库地址（应该是 `https://用户名.github.io`，不是 `https://github.com/...`）。

> **安全提醒**：CORS 只限制浏览器跨域读取，不能阻止别人直接调用你的后端。使用自己的 Key 公开部署时，建议给后端加访问口令、限流或额度控制；否则 URL 一旦被分享，Key 可能被滥用。个人使用更推荐方案 A 的自带 Key 模式。

### 部署相关文件

```text
.github/workflows/pages.yml   # GitHub Pages 自动部署
public/.nojekyll              # 关闭 Jekyll 处理
public/runtime-config.js      # 前端 API 地址 / 直连模式配置
public/direct-grader.js       # 纯静态模式的浏览器直连实现
render.yaml                   # 可选：Render 后端 Blueprint
```

## 使用说明

1. 填写作文题目（可选）、年级、文体；
2. 粘贴或导入 `.txt` 作文正文（20—6000 字）；
3. 可补充老师布置的要求，批改会更贴合任务；
4. 点击 **开始智能批改**，或按 `Ctrl + Enter`；
5. 在右侧查看总览，切换到“字词诊断”“佳段赏析”“原文批注”；
6. 点击 **打印 / PDF** 可打印报告或另存为 PDF。

## 评分与安全设计

- 使用 DeepSeek `deepseek-chat` 模型，`temperature=0.35`，开启 JSON Output，按固定 schema 校验和归一化（本地/后端模式在服务端执行，纯静态模式在浏览器执行）。
- 总分为五个维度之和；等级由总分重新计算，避免模型自相矛盾。
- 错别字、佳段、句子示例都要求逐字引用原文，程序会过滤原文中找不到的内容；佳段支持按自然段序号回退定位。
- 系统提示中明确把学生作文视为“待批改材料”，作文里出现的指令不会被执行。
- 单次请求 180 秒超时，客户端可取消；上游 401/402/429/5xx 会返回中文提示。
- 页面设置了 CSP、`X-Content-Type-Options`、`X-Frame-Options` 等安全头。

### 评分维度

| 维度 | 满分 | 关注点 |
| --- | ---: | --- |
| 内容立意 | 30 | 切题、中心、材料、真情实感 |
| 结构条理 | 20 | 开头结尾、顺序、段落、详略 |
| 语言表达 | 30 | 通顺、用词、句式、细节、修辞 |
| 字词标点 | 10 | 错别字、标点、病句 |
| 创意亮点 | 10 | 观察角度、想象、个性化表达 |

## 项目结构

```text
.
├─ server.mjs                     # 本地/后端：静态服务 + DeepSeek 调用 + SSE + CORS
├─ public/                        # 可直接发布到 GitHub Pages 的纯静态目录
│  ├─ index.html                  # 页面结构
│  ├─ styles.css                  # 视觉、响应式、打印样式
│  ├─ app.js                      # 表单、请求模式切换、报告渲染、原文批注
│  ├─ direct-grader.js            # 纯静态模式：浏览器直连 DeepSeek
│  ├─ runtime-config.js           # apiBase / directApiBase / model 配置
│  ├─ .nojekyll
│  └─ favicon.svg
├─ .github/workflows/pages.yml    # GitHub Pages 自动部署
├─ render.yaml                    # 可选：Render 后端 Blueprint
├─ .env.example
├─ package.json
└─ README.md
```

## 接口说明

### `GET /api/config`

返回是否已配置服务端 Key、模型名、字数限制、年级和文体选项。

### `POST /api/grade`

请求头：

```http
Content-Type: application/json
X-DeepSeek-Key: sk-...   # 可选；不传则使用服务端 .env
```

请求体：

```json
{
  "essay": "作文正文",
  "title": "作文题目",
  "grade": "六年级",
  "genre": "记叙文",
  "requirements": "老师布置的要求"
}
```

响应为 `text/event-stream`：

```text
event: stage       data: {"stage":"reading"}
event: progress    data: {"chars":720}
event: result      data: { ...完整批改报告... }
event: error       data: {"error":"...","code":"..."}
```

报告结果已由服务端归一化，包含 `meta`、`score`、`comments`、`typos`、`sentences`、`excellentParagraphs`、`structure`、`nextSteps`。

## 常见问题

**页面显示“待配置 Key”**

这是正常状态。点击右上角设置填写 Key，或把 Key 写入 `.env` 后重启服务。GitHub Pages 纯静态模式下，每位访问者都需要自己的 Key。

**GitHub Pages 打开是 404**

确认仓库 **Settings → Pages → Source** 已选择 **GitHub Actions**，并且 Actions 中的部署工作流已成功。注意地址是 `https://用户名.github.io/仓库名/`。

**GitHub Pages 上提示“服务未连接”**

纯静态模式本应自动切换为“浏览器直连”。如果出现这个提示，检查 `direct-grader.js` 是否上传成功、浏览器控制台是否有脚本加载错误。若配置了 `apiBase` 但后端不可用，先把 `apiBase` 改回空字符串，让页面回退到直连模式。

**后端模式报 CORS 错误**

`ALLOWED_ORIGINS` 必须精确等于 Pages 来源（例如 `https://yourname.github.io`，不带路径和末尾斜杠），修改后重启后端。

**DeepSeek 返回 401 / 402 / 429**

- 401：Key 无效或过期；
- 402：账户余额不足；
- 429：请求过于频繁，稍后再试。

**批改很久没有结果**

长作文通常需要 20—60 秒。若超过 180 秒会超时，可点“取消”后重试。也可以确认本机网络能访问 `https://api.deepseek.com`。

**模型偶尔漏掉错别字怎么办**

AI 批改是教学辅助，不替代老师逐字复核。提示词已要求只列原文中真实存在的错误，服务端也会过滤不存在的引文，但仍建议老师或家长复核。

**打印时只显示当前标签页吗**

不是。打印样式会自动展开“总览、字词诊断、佳段赏析、原文批注”四个栏目，并隐藏网页操作区。

## 声明

本项目的评分与评语由 AI 辅助生成，仅供教学参考。请结合孩子的实际水平、年级要求和老师意见使用，不用分数给孩子贴标签。
