/**
 * 小笔杆运行时配置
 *
 * 本地 Node 服务：保持 apiBase 为空即可。
 * GitHub Pages：无法运行 Node，后端不可用时页面会自动切换为“浏览器直连”模式，
 *               每位访问者需要在右上角“设置”中填写自己的 DeepSeek API Key。
 *
 * 可选：如果你把 server.mjs 部署到了 Render / Railway / Cloudflare 等后端，
 *       把 apiBase 改成后端地址（末尾不要加斜杠），并把该后端 ALLOWED_ORIGINS
 *       设置为你的 GitHub Pages 域名。这样访客就不需要填写 Key。
 *       使用独立后端时建议把 directFallback 改为 false，避免后端故障时静默切换模式。
 */
window.XBG_CONFIG = {
  apiBase: '',
  directApiBase: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  directFallback: true
};
