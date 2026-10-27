# 小笔杆 · 小学作文智能批改（GitHub Pages 版）

面向小学一至六年级的作文批改网页应用。调用 DeepSeek 接口，一次生成 **五维评分、教师评语、错别字改正、句子升级、优秀段落赏析、结构建议和原文批注**。

本版本是 **纯静态版，只面向 GitHub Pages 部署**：

- 没有 Node 后端，没有服务器，不需要安装任何依赖；
- 页面托管在 GitHub Pages；
- 每位访问者在右上角填写自己的 DeepSeek API Key；
- Key 只保存在当前标签页，由浏览器直接发送给 DeepSeek；
- 作文和 Key 都不会上传到本项目的服务器（本项目没有服务器）。

## 访问地址

部署完成后通常为：

```text
https://Shawn8086.github.io/EssayCorrection/
```

## 使用前准备

需要一枚自己的 DeepSeek API Key：

1. 打开 <https://platform.deepseek.com/api_keys>
2. 登录后创建 API Key，形如 `sk-...`
3. 确认账户有可用余额

> 不要把 Key 写进代码、README 或任何会提交到 GitHub 的文件。

## 使用步骤

1. 打开网页；
2. 点击右上角 **设置**；
3. 填入自己的 DeepSeek API Key，点击 **保存并使用**；
4. 填写作文题目（可选），选择年级和文体；
5. 粘贴或导入 `.txt` 作文正文（20—6000 字）；
6. 可补充老师布置的要求；
7. 点击 **开始智能批改**，或按 `Ctrl + Enter`；
8. 在右侧查看：
   - **批改总览**：总分、五维评分、老师总评、建议、结构、写给孩子的话
   - **字词诊断**：错别字、用词、标点、句子升级
   - **佳段赏析**：逐字摘录的精彩段落和写法分析
   - **原文批注**：在原文中高亮错字和佳段
9. 可点击 **打印 / PDF**、**复制评语**。

## Key 与隐私

- Key 保存在当前标签页的 `sessionStorage`，关闭标签页即清除；
- 浏览器直接请求 `https://api.deepseek.com`，不经过任何中间服务器；
- 页面不会把 Key 或作文写入远程数据库；
- 作文草稿保存在浏览器本机 `localStorage`，可在输入框下方看到“草稿自动保存在本机”；
- 不建议在公共电脑上填写 Key；
- DeepSeek 对请求的处理遵循其平台隐私政策。

## 部署到 GitHub Pages

仓库里已经包含：

- `public/`：完整静态网站；
- `.github/workflows/pages.yml`：推送后自动部署到 GitHub Pages。

### 1. 推送代码

```bash
git add .
git commit -m "refactor: GitHub Pages 静态版"
git push
```

### 2. 开启 Pages

打开 GitHub 仓库：

1. **Settings → Pages**
2. **Build and deployment → Source**
3. 选择 **GitHub Actions**

### 3. 等待部署

打开仓库的 **Actions** 标签，等待：

```text
Deploy 小笔杆 to GitHub Pages
```

执行完成。

访问：

```text
https://<你的用户名>.github.io/<仓库名>/
```

本仓库对应：

```text
https://Shawn8086.github.io/EssayCorrection/
```

如果 Actions 在开启 Pages 之前跑过一次并失败，点击该次运行右上角的 **Re-run all jobs**。

### 4. 更新网站

以后修改 `public/` 下的文件后：

```bash
git add .
git commit -m "update"
git push
```

GitHub Actions 会自动重新部署。

## 自定义域名

1. 在 **Settings → Pages → Custom domain** 填写域名；
2. 在 `public/` 下新建 `CNAME` 文件，内容为域名（不要带 `https://`）；
3. 提交推送；
4. 按 GitHub 提示配置 DNS。

## 项目结构

```text
.
├─ .github/
│  └─ workflows/
│     └─ pages.yml          # GitHub Pages 自动部署
├─ public/                  # 发布目录，全部为静态文件
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js                # 表单、设置、报告渲染、原文批注
│  ├─ direct-grader.js      # 浏览器直连 DeepSeek + 结果校验
│  ├─ runtime-config.js     # 接口地址与模型
│  ├─ favicon.svg
│  └─ .nojekyll
└─ README.md
```

## 实现方式

- 纯 HTML / CSS / JavaScript，无构建步骤、无第三方运行时依赖；
- 调用 DeepSeek `deepseek-chat`，开启 JSON Output；
- 浏览器以 `Authorization: Bearer <Key>` 直接请求 DeepSeek API；
- 使用 `fetch` 读取 SSE 流，展示生成进度；
- 结果按固定 schema 在浏览器内归一化：
  - 总分由五个维度重新相加；
  - 过滤原文中不存在的“错别字”和“佳段”引用；
  - 佳段支持按自然段序号回退定位；
- 系统提示词把学生作文视为待批改材料，作文中的指令不会被执行；
- 单次请求 180 秒超时，可手动取消；
- 支持打印样式，打印时自动展开全部四个栏目。

## 本地预览（可选）

GitHub Pages 只托管静态文件。如果需要先在本机看效果，可以用任意静态文件服务器打开 `public/`，例如：

```bash
python -m http.server 8000 --directory public
```

然后访问 <http://127.0.0.1:8000>。

不要直接双击 `index.html` 以 `file://` 方式使用；浏览器可能会限制跨域请求。

## 常见问题

**打开后显示“待配置 Key”**

正常。点击右上角设置，填入自己的 Key。

**提示 401 / 402 / 429**

- 401：Key 无效或已过期；
- 402：账户余额不足；
- 429：请求过于频繁，稍后再试。

**提示无法连接 DeepSeek**

确认网络能访问 `https://api.deepseek.com`，并检查浏览器是否拦截了跨域请求。DeepSeek 官方接口目前支持浏览器 CORS。

**Pages 页面 404**

确认 **Settings → Pages → Source** 已选择 **GitHub Actions**，并等待 Actions 部署成功。

**页面样式或脚本没有更新**

等待 Actions 完成后强制刷新浏览器（`Ctrl + F5`）。

**能否让访客不填 Key**

不能。本版本只使用 GitHub Pages，没有后端可以安全保存共享 Key。每位访问者必须使用自己的 Key。若要让访客无需 Key，需要另行部署一个 API 代理服务，那不属于本静态版本的范围。

## 声明

评分与评语由 AI 辅助生成，仅供教学参考。请结合孩子的实际水平、年级要求和老师意见使用，不用分数给孩子贴标签。
