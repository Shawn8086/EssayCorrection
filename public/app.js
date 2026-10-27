'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
const GENRES = ['记叙文', '写人', '写景', '状物', '想象作文', '读后感', '书信', '日记', '其他'];
const DRAFT_KEY = 'xiaobigan_draft_v1';
const KEY_STORAGE = 'xiaobigan_temp_key_v1';
const MAX_CHARS = 6000;
const MIN_CHARS = 20;

const RUNTIME_CONFIG = window.XBG_CONFIG && typeof window.XBG_CONFIG === 'object' ? window.XBG_CONFIG : {};
const API_BASE = String(RUNTIME_CONFIG.apiBase || '').replace(/\/+$/, '');

const STAGE_HINTS = [
  '先通读全文，理解孩子想表达什么。',
  '对照年级标准，看看内容、结构和语言。',
  '逐字查找错别字、病句和标点问题。',
  '正在把批改结果整理成一份报告。'
];

const SAMPLE = {
  title: '雨中的那把伞',
  grade: '六年级',
  genre: '记叙文',
  requirements: '写一件让你感动的事，注意通过动作和语言表现人物。',
  essay: `那天的雨，来得一点预兆也没有。

放学铃刚响，天色就暗了下来。我站在教学楼的屋檐下，看雨点砸在地上，溅起一朵朵白色的小花。同学们一个个被家长接走，校门口渐渐安静下来，只剩我抱着书包，盯着雨帘发呆。爸爸今天加班，妈妈说过会晚一点，可天已经黑了。

即然没人来，我决定自己跑回去。刚冲进雨里，一把深蓝色的伞忽然撑在我头顶。我回头一看，是同桌林小满。她喘着气，刘海湿漉漉地贴在额头上，却把伞往我这边斜了斜，说：“顺路，一起走吧。”

雨点噼里啪啦地敲着伞面，像一支不成调的小鼓。我们踩着水洼往前走，她的右肩很快湿了一大片。我把伞推回去，她又悄悄推回来，还故意把脚步放慢，说：“我以经到家了，你多遮一点。”我忍不住笑她：“你家还在前面呢。”她也笑了，露出两颗小虎牙。

到了我家楼下，她把伞塞进我手里，转身跑进雨里。我喊她拿伞，她头也不回地摆摆手：“明天还我！”那一刻，雨还是那么大，可我心里像忽然照进了一束光。

第二天，我把伞还给她，伞柄上还留着我手心的温度。她接过去，什么也没说，只对我笑了笑。原来，真正的友谊不一定要说很多话，有时只是一把悄悄斜过来的伞。`
};

const state = {
  config: null,
  configError: false,
  directMode: false,
  apiKey: readSessionKey(),
  report: null,
  reportEssay: '',
  reportSubmission: null,
  controller: null,
  gotResult: false,
  lastSubmission: null,
  stageTimer: null,
  stageIndex: 0,
  loadingStartedAt: 0,
  draftTimer: null,
  draftStatusTimer: null,
  toastTimer: null,
  activeTab: 'overview',
  lastFocused: null,
  busy: false
};

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

init();

async function init() {
  populateSelects();
  bindEvents();
  restoreDraft();
  updateCharCount();
  updateConnectionStatus();

  await loadConfig();
  updateConnectionStatus();
  updateServerCard();
  updateRuntimeUi();
}

function populateSelects() {
  const gradeSelect = $('#gradeSelect');
  const genreSelect = $('#genreSelect');
  gradeSelect.innerHTML = GRADES.map((grade) => `<option value="${grade}">${grade}</option>`).join('');
  genreSelect.innerHTML = GENRES.map((genre) => `<option value="${genre}">${genre}</option>`).join('');
  gradeSelect.value = '六年级';
  genreSelect.value = '记叙文';
}

function bindEvents() {
  $('#essayForm').addEventListener('submit', handleSubmit);
  $('#essayInput').addEventListener('input', handleEssayInput);
  $('#titleInput').addEventListener('input', scheduleDraftSave);
  $('#requirementsInput').addEventListener('input', scheduleDraftSave);
  $('#gradeSelect').addEventListener('change', scheduleDraftSave);
  $('#genreSelect').addEventListener('change', scheduleDraftSave);
  $('#essayInput').addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      $('#essayForm').requestSubmit();
    }
  });

  $('#sampleBtn').addEventListener('click', fillSample);
  $('#clearBtn').addEventListener('click', clearComposer);
  $('#fileInput').addEventListener('change', importTxt);
  $('#cancelBtn').addEventListener('click', cancelRequest);
  $('#retryBtn').addEventListener('click', () => $('#essayForm').requestSubmit());
  $('#errorSettingsBtn').addEventListener('click', () => openSettings());
  $('#settingsBtn').addEventListener('click', () => openSettings());
  $('#statusBtn').addEventListener('click', () => openSettings());
  $('#modalCloseBtn').addEventListener('click', closeSettings);
  $('#saveKeyBtn').addEventListener('click', saveKey);
  $('#clearKeyBtn').addEventListener('click', clearKey);
  $('#keyToggleBtn').addEventListener('click', toggleKeyVisibility);
  $('#settingsModal').addEventListener('click', (event) => {
    if (event.target === $('#settingsModal')) closeSettings();
  });
  $('#settingsModal').addEventListener('keydown', trapModalFocus);

  $$('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });

  $('#printBtn').addEventListener('click', () => window.print());
  $('#copyBtn').addEventListener('click', copyComments);
  $('#reviseBtn').addEventListener('click', reviseEssay);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#settingsModal').hidden) closeSettings();
  });
}

/* ------------------------------------------------------------------ */
/* Config + status                                                    */
/* ------------------------------------------------------------------ */

async function loadConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/config`, { cache: 'no-store' });
    if (!response.ok) throw new Error('config failed');
    const data = await response.json();
    state.config = data;
    state.configError = false;
    state.directMode = false;

    if (Array.isArray(data.grades) && data.grades.length) {
      const current = $('#gradeSelect').value;
      $('#gradeSelect').innerHTML = data.grades.map((grade) => `<option value="${grade}">${grade}</option>`).join('');
      $('#gradeSelect').value = data.grades.includes(current) ? current : data.grades[data.grades.length - 1];
    }
    if (Array.isArray(data.genres) && data.genres.length) {
      const current = $('#genreSelect').value;
      $('#genreSelect').innerHTML = data.genres.map((genre) => `<option value="${genre}">${genre}</option>`).join('');
      $('#genreSelect').value = data.genres.includes(current) ? current : data.genres[0];
    }
  } catch {
    if (RUNTIME_CONFIG.directFallback !== false && window.XBGDirect?.isAvailable) {
      state.directMode = true;
      state.configError = false;
      state.config = {
        configured: false,
        direct: true,
        model: String(RUNTIME_CONFIG.model || 'deepseek-chat'),
        maxChars: MAX_CHARS,
        minChars: MIN_CHARS,
        grades: GRADES,
        genres: GENRES
      };
    } else {
      state.config = null;
      state.configError = true;
    }
  }
}

function updateRuntimeUi() {
  const direct = state.directMode;
  const modalDesc = $('#modalDesc');
  const keyHint = $('#keyHint');
  const envHelp = $('#envHelp');
  const privacyNote = $('#privacyNoteText');

  if (direct) {
    if (modalDesc) {
      modalDesc.innerHTML =
        '当前是静态部署模式：页面没有后端，由浏览器直接调用 DeepSeek。请填写你自己的 API Key，它只会留在本机。';
    }
    if (keyHint) {
      keyHint.innerHTML =
        '只保存在本标签页的 <code>sessionStorage</code>，并由浏览器直接发送给 DeepSeek；不经过本页面服务器，也不会写入本页面的服务器日志。';
    }
    if (envHelp) envHelp.hidden = true;
    if (privacyNote) privacyNote.textContent = 'Key 只存本机；作文直接发送给 DeepSeek 用于本次批改。';
  } else {
    if (modalDesc) {
      modalDesc.innerHTML =
        '小笔杆通过 DeepSeek 官方接口批改作文。你可以把 Key 写在服务端 <code>.env</code> 中，也可以只放在当前浏览器标签页里。';
    }
    if (keyHint) {
      keyHint.innerHTML =
        '只保存在本标签页的 <code>sessionStorage</code>，关闭标签页即清除；请求时发送给本机服务，不写入服务器日志。';
    }
    if (envHelp) envHelp.hidden = false;
    if (privacyNote) privacyNote.textContent = '作文仅用于本次 AI 批改，不在服务器留存。';
  }
}

function updateConnectionStatus() {
  const button = $('#statusBtn');
  const label = $('#statusText');
  button.classList.remove('is-ready', 'is-missing', 'is-error', 'is-loading');

  if (state.configError) {
    button.classList.add('is-error');
    label.textContent = '服务未连接';
    button.title = '无法读取服务配置，请确认服务已启动';
    button.setAttribute('aria-label', 'DeepSeek 状态：服务未连接，点击查看设置');
    return;
  }

  if (state.config === null) {
    button.classList.add('is-loading');
    label.textContent = '正在检查连接';
    button.setAttribute('aria-label', 'DeepSeek 状态：正在检查连接');
    return;
  }

  const hasServerKey = Boolean(state.config.configured);
  const hasTempKey = Boolean(state.apiKey);

  if (state.directMode) {
    if (hasTempKey) {
      button.classList.add('is-ready');
      label.textContent = '浏览器直连已就绪';
      button.title = '正在使用本标签页的 Key 直连 DeepSeek';
      button.setAttribute('aria-label', 'DeepSeek 状态：浏览器直连已就绪，点击查看设置');
    } else {
      button.classList.add('is-missing');
      label.textContent = '待配置 Key';
      button.title = '静态站点需要你自己的 DeepSeek API Key';
      button.setAttribute('aria-label', 'DeepSeek 状态：待配置 Key，点击填写');
    }
    return;
  }

  if (hasServerKey || hasTempKey) {
    button.classList.add('is-ready');
    label.textContent = hasServerKey ? 'DeepSeek 已连接' : '临时 Key 已就绪';
    button.title = hasServerKey ? '服务端已配置 DeepSeek Key' : '正在使用本标签页的临时 Key';
    button.setAttribute('aria-label', `DeepSeek 状态：${label.textContent}，点击查看设置`);
  } else {
    button.classList.add('is-missing');
    label.textContent = '待配置 Key';
    button.title = '点击填写 DeepSeek API Key';
    button.setAttribute('aria-label', 'DeepSeek 状态：待配置 Key，点击填写');
  }
}

function updateServerCard() {
  const card = $('#serverStatusCard');
  const title = $('#serverStatusTitle');
  const text = $('#serverStatusText');
  if (!card || !title || !text) return;

  card.classList.remove('is-ready');

  if (state.configError) {
    title.textContent = '无法连接批改服务';
    text.textContent = '请确认后端已启动，以及 runtime-config.js 中的 apiBase 填写正确。';
    return;
  }

  if (state.config === null) {
    title.textContent = '正在检查服务配置';
    text.textContent = '请稍候…';
    return;
  }

  if (state.directMode) {
    card.classList.toggle('is-ready', Boolean(state.apiKey));
    title.textContent = '静态部署 · 浏览器直连';
    text.textContent = state.apiKey
      ? 'Key 只保存在本机，批改请求直接发送给 DeepSeek。'
      : '请填写你自己的 DeepSeek API Key；它只保存在本机浏览器。';
    return;
  }

  if (state.config.configured) {
    card.classList.add('is-ready');
    title.textContent = '服务端 Key 已配置';
    text.textContent = '可以直接批改；在下方填写临时 Key 可临时覆盖。';
  } else {
    title.textContent = '服务端尚未配置 Key';
    text.textContent = '填写下方临时 Key，或写入 .env 后重启服务。';
  }
}

/* ------------------------------------------------------------------ */
/* Draft + composer                                                   */
/* ------------------------------------------------------------------ */

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return;

    $('#titleInput').value = typeof draft.title === 'string' ? draft.title : '';
    $('#essayInput').value = typeof draft.essay === 'string' ? draft.essay : '';
    $('#requirementsInput').value = typeof draft.requirements === 'string' ? draft.requirements : '';
    if (GRADES.includes(draft.grade)) $('#gradeSelect').value = draft.grade;
    if (GENRES.includes(draft.genre)) $('#genreSelect').value = draft.genre;

    if ($('#essayInput').value.trim()) {
      setDraftStatus('已恢复上次草稿', true);
    }
  } catch {
    /* localStorage may be unavailable */
  }
}

function scheduleDraftSave() {
  clearTimeout(state.draftTimer);
  setDraftStatus('正在保存草稿…', false);
  state.draftTimer = setTimeout(() => {
    saveDraft();
    setDraftStatus('已自动保存', true);
  }, 450);
}

function saveDraft() {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title: $('#titleInput').value,
        essay: $('#essayInput').value,
        grade: $('#gradeSelect').value,
        genre: $('#genreSelect').value,
        requirements: $('#requirementsInput').value,
        savedAt: Date.now()
      })
    );
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function setDraftStatus(text, saved) {
  const node = $('#draftStatus');
  node.textContent = text;
  node.classList.toggle('is-saved', Boolean(saved));
  clearTimeout(state.draftStatusTimer);
  if (saved) {
    state.draftStatusTimer = setTimeout(() => {
      node.textContent = '草稿自动保存在本机';
      node.classList.remove('is-saved');
    }, 2600);
  }
}

function handleEssayInput() {
  updateCharCount();
  scheduleDraftSave();
}

function updateCharCount() {
  const count = countChars($('#essayInput').value);
  $('#charCount').innerHTML = `<b>${count.toLocaleString('zh-CN')}</b> / ${MAX_CHARS.toLocaleString('zh-CN')} 字`;
}

function fillSample() {
  if ($('#essayInput').value.trim() && !window.confirm('填入示例会覆盖当前正文，确定继续吗？')) return;

  $('#titleInput').value = SAMPLE.title;
  $('#essayInput').value = SAMPLE.essay;
  $('#requirementsInput').value = SAMPLE.requirements;
  $('#gradeSelect').value = SAMPLE.grade;
  $('#genreSelect').value = SAMPLE.genre;
  updateCharCount();
  saveDraft();
  setDraftStatus('示例已填入', true);
  showToast('示例作文已填入，可以直接批改');
  const essayInput = $('#essayInput');
  essayInput.focus();
  essayInput.setSelectionRange(0, 0);
  essayInput.scrollTop = 0;
}

function clearComposer() {
  const hasContent =
    $('#titleInput').value.trim() ||
    $('#essayInput').value.trim() ||
    $('#requirementsInput').value.trim();
  if (hasContent && !window.confirm('确定清空当前作文吗？清空后无法恢复。')) return;

  $('#titleInput').value = '';
  $('#essayInput').value = '';
  $('#requirementsInput').value = '';
  updateCharCount();
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
  setDraftStatus('草稿已清空', false);
  $('#essayInput').focus();
}

async function importTxt(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  if (file.size > 180 * 1024) {
    showToast('文件太大了，请选择 180KB 以内的 txt 文件', true);
    return;
  }

  try {
    const text = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (!text.trim()) {
      showToast('这个文件是空的', true);
      return;
    }
    if (countChars(text) > MAX_CHARS) {
      showToast(`文件超过 ${MAX_CHARS} 字，请精简后再导入`, true);
      return;
    }
    if ($('#essayInput').value.trim() && !window.confirm('导入会覆盖当前正文，确定继续吗？')) return;

    $('#essayInput').value = text.trim();
    if (!$('#titleInput').value.trim()) {
      $('#titleInput').value = file.name.replace(/\.txt$/i, '').slice(0, 60);
    }
    updateCharCount();
    saveDraft();
    setDraftStatus('已导入 txt', true);
    showToast('作文已导入');
    $('#essayInput').scrollTop = 0;
  } catch {
    showToast('读取文件失败，请换一个 txt 文件试试', true);
  }
}

/* ------------------------------------------------------------------ */
/* Submit + SSE                                                       */
/* ------------------------------------------------------------------ */

async function handleSubmit(event) {
  event?.preventDefault();
  if (state.busy) return;

  const essay = $('#essayInput').value.trim();
  const chars = countChars(essay);

  if (chars < MIN_CHARS) {
    showToast(`作文至少需要 ${MIN_CHARS} 个字，先把想说的话写下来吧`, true);
    $('#essayInput').focus();
    return;
  }
  if (chars > MAX_CHARS) {
    showToast(`作文最多 ${MAX_CHARS} 字，请精简后再试`, true);
    return;
  }

  const hasKey = Boolean(state.apiKey) || Boolean(state.config?.configured);
  if (state.config && !hasKey) {
    showToast('请先配置 DeepSeek API Key', true);
    openSettings();
    return;
  }

  const submission = {
    essay,
    title: $('#titleInput').value.trim(),
    grade: $('#gradeSelect').value,
    genre: $('#genreSelect').value,
    requirements: $('#requirementsInput').value.trim()
  };

  saveDraft();
  startLoading(submission);
  state.controller = new AbortController();
  setBusy(true);

  try {
    if (state.directMode) {
      await gradeDirect(submission);
    } else {
      await gradeViaServer(submission);
    }
  } catch (error) {
    handleGradeFailure(error);
  } finally {
    cleanupLoading();
    state.controller = null;
    setBusy(false);
  }
}

async function gradeDirect(submission) {
  const grader = window.XBGDirect;
  if (!grader || typeof grader.grade !== 'function') {
    throw new AppError('直连模块没有加载成功，请刷新页面后重试。', 'DIRECT_UNAVAILABLE');
  }

  const report = await grader.grade({
    ...submission,
    apiKey: state.apiKey,
    signal: state.controller.signal,
    onStage: (stage) => {
      if (stage === 'organizing') setLoadingStage(3);
    },
    onProgress: (chars) => {
      $('#progressText').textContent = `已生成 ${Number(chars).toLocaleString('zh-CN')} 字批改内容`;
      if (chars > 1400) setLoadingStage(3);
    }
  });

  finishWithReport(report, submission);
}

async function gradeViaServer(submission) {
  const response = await fetch(`${API_BASE}/api/grade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(state.apiKey ? { 'X-DeepSeek-Key': state.apiKey } : {})
    },
    body: JSON.stringify(submission),
    signal: state.controller.signal
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      /* ignore */
    }
    throw new AppError(
      payload.error || `批改请求失败（HTTP ${response.status}）`,
      payload.code || 'HTTP_ERROR'
    );
  }

  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json();
    if (payload?.score && payload?.meta) {
      finishWithReport(payload, submission);
      return;
    }
    throw new AppError('服务器返回了无法识别的结果，请重试。', 'BAD_RESPONSE');
  }

  await consumeSSE(response, submission);
  if (!state.gotResult) {
    throw new AppError('连接提前结束了，请再试一次。', 'STREAM_ENDED');
  }
}

function handleGradeFailure(error) {
  if (error?.name === 'AbortError') {
    showError('批改已取消，作文还在，随时可以再试一次。', {
      title: '已取消本次批改',
      code: 'CANCELLED'
    });
    return;
  }

  const known = error instanceof AppError || error?.name === 'DirectError';
  const message = known && error.message ? error.message : '网络似乎不太稳定，请检查连接后重试。';
  const code = known && error.code ? error.code : 'NETWORK_ERROR';
  showError(message, { code });
  if (['NO_KEY', 'BAD_KEY', 'AUTH_ERROR'].includes(code)) {
    openSettings(message);
  }
}

async function consumeSSE(response, submission) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const separator = /\r?\n\r?\n/;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let match;
    while ((match = separator.exec(buffer))) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      if (handleSSEBlock(block, submission)) return;
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) handleSSEBlock(buffer, submission);
}

function handleSSEBlock(block, submission) {
  let eventName = 'message';
  const dataLines = [];

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }

  if (!dataLines.length) return false;

  let payload;
  try {
    payload = JSON.parse(dataLines.join('\n'));
  } catch {
    return false;
  }

  if (eventName === 'stage') {
    if (payload.stage === 'organizing') {
      setLoadingStage(3);
    } else {
      setLoadingHint('AI 正在认真读这篇作文…');
    }
    return false;
  }

  if (eventName === 'progress') {
    const chars = Number(payload.chars) || 0;
    $('#progressText').textContent = `已生成 ${chars.toLocaleString('zh-CN')} 字批改内容`;
    if (chars > 1400 && state.stageIndex < 3) setLoadingStage(3);
    return false;
  }

  if (eventName === 'error') {
    throw new AppError(payload.error || '批改没有完成，请重试。', payload.code || 'GRADE_ERROR');
  }

  if (eventName === 'result') {
    state.gotResult = true;
    finishWithReport(payload, submission);
    return true;
  }

  return false;
}

function finishWithReport(report, submission) {
  state.report = report;
  state.reportEssay = submission.essay;
  state.reportSubmission = submission;
  renderReport(report, submission);
  showReport();
}

function startLoading(submission) {
  state.lastSubmission = submission;
  state.gotResult = false;
  state.report = null;
  state.stageIndex = 0;
  state.loadingStartedAt = Date.now();
  $('#emptyState').hidden = true;
  $('#errorState').hidden = true;
  $('#report').hidden = true;
  $('#loadingState').hidden = false;
  setReportState('AI 批改中', 'busy');
  setLoadingStage(0);
  $('#progressText').textContent = 'AI 正在工作，请稍候';
  $('#progressBar').style.width = '38%';

  clearInterval(state.stageTimer);
  state.stageTimer = setInterval(() => {
    if (state.stageIndex < 2) {
      setLoadingStage(state.stageIndex + 1);
    } else {
      $('#loadingHint').textContent = '长一点的作文会多花一点时间，请再等等。';
    }
  }, 6800);

  if (window.innerWidth <= 1020) {
    setTimeout(() => {
      $('#resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
}

function setLoadingStage(index) {
  state.stageIndex = Math.max(0, Math.min(3, Number(index) || 0));
  $$('#loadingSteps li').forEach((item, itemIndex) => {
    item.classList.toggle('is-done', itemIndex < state.stageIndex);
    item.classList.toggle('is-active', itemIndex === state.stageIndex);
  });
  $('#loadingHint').textContent = STAGE_HINTS[state.stageIndex] || STAGE_HINTS[0];
}

function setLoadingHint(text) {
  $('#loadingHint').textContent = text;
}

function cleanupLoading() {
  clearInterval(state.stageTimer);
  state.stageTimer = null;
}

function cancelRequest() {
  if (state.controller) {
    state.controller.abort();
  } else {
    showError('批改已取消，作文还在，随时可以再试一次。', { title: '已取消本次批改', code: 'CANCELLED' });
  }
}

function setBusy(busy) {
  state.busy = busy;
  const button = $('#gradeBtn');
  button.disabled = busy;
  button.classList.toggle('is-busy', busy);
  $('span', button).textContent = busy ? '正在批改…' : '开始智能批改';
}

function showError(message, { title = '这次没有批改成功', code = '' } = {}) {
  cleanupLoading();
  $('#loadingState').hidden = true;
  $('#emptyState').hidden = true;
  $('#report').hidden = true;
  $('#errorState').hidden = false;
  $('#errorTitle').textContent = title;
  $('#errorMessage').textContent = message || '请稍后再试一次。';
  $('#errorSettingsBtn').hidden = !['NO_KEY', 'BAD_KEY', 'AUTH_ERROR', 'INSUFFICIENT_BALANCE'].includes(code);
  setReportState('未完成', '');
  if (window.innerWidth <= 1020) {
    $('#resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function showReport() {
  cleanupLoading();
  $('#loadingState').hidden = true;
  $('#emptyState').hidden = true;
  $('#errorState').hidden = true;
  $('#report').hidden = false;
  setReportState('批改完成', 'ready');
  if (window.innerWidth <= 1020) {
    $('#resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function setReportState(text, mode) {
  const node = $('#reportState');
  node.textContent = text;
  node.classList.remove('is-busy', 'is-ready');
  if (mode) node.classList.add(`is-${mode}`);
}

/* ------------------------------------------------------------------ */
/* Report rendering                                                   */
/* ------------------------------------------------------------------ */

function renderReport(report, submission) {
  const score = report.score || {};
  const meta = report.meta || {};
  const comments = report.comments || {};
  const total = clamp(Number(score.total) || 0, 0, 100);

  $('#scoreRing').style.setProperty('--score', total);
  $('#scoreTotal').textContent = total;
  $('#scoreLevel').textContent = score.level || '良好';
  $('#scoreHeadline').textContent = score.headline || '这篇作文有属于自己的光。';
  $('#scoreRubric').textContent = score.rubricNote || '评分依据年级标准，结合内容、结构、语言、字词与创意综合给出。';
  $('#reportMeta').textContent = [
    meta.grade || submission.grade,
    meta.genre || submission.genre,
    `${meta.charCount || countChars(submission.essay)} 字`,
    `${meta.paragraphCount || splitParagraphs(submission.essay).length} 段`
  ].join(' · ');

  $('#praiseText').textContent = comments.praise || '这篇文章有值得被看见的地方，继续读下去。';
  $('#overallText').textContent = comments.overall || '整体表达完整。下一步可以抓住一个最想改的地方，把它写得更具体。';

  renderDimensions(score.dimensions || []);
  renderAdvice(comments.advice || []);
  renderNextSteps(report.nextSteps || [], comments.advice || []);
  renderStructure(report.structure || {});

  const teacherNote = comments.teacherNote || '';
  $('#teacherNote').textContent = teacherNote;
  $('#teacherNote').closest('.teacher-note').hidden = !teacherNote;

  renderTypos(report.typos || []);
  renderSentences(report.sentences || []);
  renderExcellent(report.excellentParagraphs || []);
  renderAnnotation(report, submission.essay);

  const issueCount = (report.typos || []).length + (report.sentences || []).length;
  $('#languageCount').textContent = issueCount;
  $('#excellentCount').textContent = (report.excellentParagraphs || []).length;
  $('#reportModel').textContent = `${report.model || 'DeepSeek'} · ${formatDateTime(report.generatedAt || new Date())}`;
  $('#printDate').textContent = `打印时间：${formatDateTime(new Date())}`;

  activateTab('overview');
  document.title = `批改报告 · ${meta.title || submission.title || '作文'} · 小笔杆`;
}

function renderDimensions(dimensions) {
  const list = $('#dimensionsList');
  if (!dimensions.length) {
    list.innerHTML = '<div class="empty-note"><p>评分维度暂时缺失，请重试一次。</p></div>';
    return;
  }

  list.innerHTML = dimensions
    .map((dimension) => {
      const max = Number(dimension.max) || 1;
      const score = Number(dimension.score) || 0;
      const percent = clamp((score / max) * 100, 0, 100);
      const low = percent < 60 ? ' is-low' : '';
      return `
        <div class="dimension-row${low}">
          <div class="dimension-top">
            <span class="dimension-name">${escapeHtml(dimension.name)}<small>满分 ${max}</small></span>
            <span class="dimension-score"><b>${score}</b> / ${max}</span>
          </div>
          <div class="dimension-bar"><i style="width:${percent.toFixed(1)}%"></i></div>
          <p class="dimension-comment">${escapeHtml(dimension.comment || '这一项还可以写得更具体。')}</p>
        </div>`;
    })
    .join('');
}

function renderAdvice(advice) {
  const list = $('#adviceList');
  if (!advice.length) {
    list.innerHTML = '<div class="empty-note"><p>这次没有生成额外建议，可以先从老师总评里挑一处来改。</p></div>';
    return;
  }
  list.innerHTML = advice
    .map(
      (item, index) => `
      <div class="advice-card">
        <b>${String(index + 1).padStart(2, '0')}</b>
        <p>${escapeHtml(item)}</p>
      </div>`
    )
    .join('');
}

function renderNextSteps(steps, advice) {
  const section = $('#nextStepsList').closest('.section-block');
  const items = steps.length ? steps : advice;
  if (!items.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  $('#nextStepsList').innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderStructure(structure) {
  $('#structureOutline').textContent =
    structure.outline || '文章的结构信息暂时缺失，可以重点看看开头、中间和结尾是否各司其职。';
  const suggestions = structure.suggestions || [];
  const list = $('#structureSuggestions');
  list.innerHTML = suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  list.hidden = !suggestions.length;
}

function renderTypos(typos) {
  const list = $('#typoList');
  if (!typos.length) {
    list.innerHTML = `
      <div class="empty-note">
        <div class="empty-icon">净</div>
        <h5>没有发现明显错别字</h5>
        <p>字词和标点都用得比较稳。保持写完后再读一遍的习惯，会更棒。</p>
      </div>`;
    return;
  }

  list.innerHTML = typos
    .map((typo) => {
      const correct = typo.correct ? escapeHtml(typo.correct) : '删除';
      return `
        <div class="typo-card">
          <div class="typo-change">
            <span class="typo-wrong">${escapeHtml(typo.wrong)}</span>
            <span class="typo-arrow">→</span>
            <span class="typo-correct">${correct}</span>
            <span class="typo-type">${escapeHtml(typo.type || '错别字')}</span>
          </div>
          <p class="typo-context">${highlightContext(typo.context, typo.wrong)}</p>
          <p class="typo-explain">${escapeHtml(typo.explanation || '建议改成正确的写法。')}</p>
        </div>`;
    })
    .join('');
}

function renderSentences(sentences) {
  const list = $('#sentenceList');
  if (!sentences.length) {
    list.innerHTML = `
      <div class="empty-note">
        <div class="empty-icon">句</div>
        <h5>这次没有需要升级的句子</h5>
        <p>并不是每句话都要改。保留自己的语气，也是一种好表达。</p>
      </div>`;
    return;
  }

  list.innerHTML = sentences
    .map(
      (sentence) => `
      <div class="sentence-card">
        <span class="sentence-label">原句</span>
        <p class="sentence-original">${escapeHtml(sentence.original)}</p>
        <span class="sentence-label">可以这样改</span>
        <p class="sentence-revised">${escapeHtml(sentence.revised)}</p>
        <p class="sentence-reason">${escapeHtml(sentence.reason || '这样改，画面和语气会更清楚。')}</p>
      </div>`
    )
    .join('');
}

function renderExcellent(paragraphs) {
  const list = $('#excellentList');
  if (!paragraphs.length) {
    list.innerHTML = `
      <div class="empty-note">
        <div class="empty-icon">芽</div>
        <h5>这次没有单独摘出佳段</h5>
        <p>没有摘出，不代表没有亮点。把最满意的一句读给家人听，也是一种发现。</p>
      </div>`;
    return;
  }

  list.innerHTML = paragraphs
    .map(
      (paragraph) => `
      <div class="excellent-card">
        <span class="excellent-tag">★ 第 ${paragraph.index || 1} 段 · ${escapeHtml(paragraph.technique || '精彩片段')}</span>
        <p class="excellent-text">${escapeHtml(paragraph.text)}</p>
        <p class="excellent-why"><b>好在哪里</b><span>${escapeHtml(paragraph.why || '这一段有自己的观察和语气，值得保留。')}</span></p>
      </div>`
    )
    .join('');
}

function renderAnnotation(report, essay) {
  const paper = $('#annotatedPaper');
  const paragraphs = splitParagraphs(essay);
  const typos = report.typos || [];
  const excellent = report.excellentParagraphs || [];
  const usedTypos = new Set();
  const usedExcellent = new Set();
  let typoMarks = 0;

  paper.textContent = '';

  paragraphs.forEach((paragraph) => {
    const p = document.createElement('p');
    p.className = 'para';

    const goodIndex = excellent.findIndex((item, index) => {
      if (usedExcellent.has(index) || !item.text) return false;
      return paragraph.includes(item.text) || normalizeSpace(paragraph).includes(normalizeSpace(item.text));
    });
    if (goodIndex >= 0) {
      p.classList.add('is-excellent');
      usedExcellent.add(goodIndex);
    }

    const ranges = [];
    typos.forEach((typo, index) => {
      if (usedTypos.has(index) || !typo.wrong) return;
      let position = -1;

      if (typo.context) {
        const contextPosition = paragraph.indexOf(typo.context);
        if (contextPosition >= 0) {
          const within = typo.context.indexOf(typo.wrong);
          if (within >= 0) position = contextPosition + within;
        }
      }
      if (position < 0) {
        const within = paragraph.indexOf(typo.wrong);
        if (within >= 0) position = within;
      }

      if (position >= 0 && !ranges.some((range) => overlaps(position, position + typo.wrong.length, range))) {
        ranges.push({
          start: position,
          end: position + typo.wrong.length,
          typo
        });
        usedTypos.add(index);
        typoMarks += 1;
      }
    });

    ranges.sort((a, b) => a.start - b.start);
    let cursor = 0;

    ranges.forEach((range) => {
      if (range.start > cursor) {
        p.appendChild(document.createTextNode(paragraph.slice(cursor, range.start)));
      }
      const mark = document.createElement('mark');
      mark.className = 'typo-mark';
      mark.textContent = paragraph.slice(range.start, range.end);
      mark.title = range.typo.correct ? `建议改为「${range.typo.correct}」` : '建议删除';
      p.appendChild(mark);

      const fix = document.createElement('span');
      fix.className = 'typo-fix';
      fix.textContent = range.typo.correct ? `→${range.typo.correct}` : '删';
      p.appendChild(fix);
      cursor = range.end;
    });

    if (cursor < paragraph.length) {
      p.appendChild(document.createTextNode(paragraph.slice(cursor)));
    }

    paper.appendChild(p);
  });

  $('#annotatedStats').innerHTML = `
    <span>全文 <b>${countChars(essay).toLocaleString('zh-CN')}</b> 字</span>
    <span><b>${paragraphs.length}</b> 个自然段</span>
    <span>标出 <b>${typoMarks}</b> 处错字 / 用词</span>
    <span>佳段 <b>${usedExcellent.size}</b> 处</span>`;
}

/* ------------------------------------------------------------------ */
/* Tabs + report actions                                              */
/* ------------------------------------------------------------------ */

function activateTab(name) {
  const tabs = $$('.tab-btn');
  const panels = $$('.tab-panel');
  const exists = tabs.some((tab) => tab.dataset.tab === name);
  const target = exists ? name : 'overview';

  tabs.forEach((tab) => {
    const active = tab.dataset.tab === target;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== target;
  });

  state.activeTab = target;
}

function copyComments() {
  if (!state.report) return;
  const report = state.report;
  const meta = report.meta || {};
  const comments = report.comments || {};
  const dimensions = (report.score?.dimensions || [])
    .map((item) => `${item.name} ${item.score}/${item.max}`)
    .join('，');

  const text = [
    '【小笔杆 · 小学作文批改报告】',
    `题目：${meta.title || '未拟题'}`,
    `年级：${meta.grade || ''}　文体：${meta.genre || ''}　字数：${meta.charCount || ''}`,
    `总分：${report.score?.total ?? ''}/100（${report.score?.level || ''}）`,
    dimensions ? `维度：${dimensions}` : '',
    '',
    `【老师总评】\n${comments.praise || ''}\n${comments.overall || ''}`,
    comments.advice?.length ? `【三个小建议】\n${comments.advice.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
    comments.teacherNote ? `【写给孩子的话】\n${comments.teacherNote}` : '',
    '',
    '由小笔杆 + DeepSeek 辅助生成，供教学参考。'
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  copyText(text)
    .then(() => showToast('评语已复制到剪贴板'))
    .catch(() => showToast('复制失败，请手动选择文字复制', true));
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
    } catch (error) {
      reject(error);
    } finally {
      textarea.remove();
    }
  });
}

function reviseEssay() {
  $('.composer').scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    $('#essayInput').focus();
    const length = $('#essayInput').value.length;
    $('#essayInput').setSelectionRange(length, length);
  }, 420);
}

/* ------------------------------------------------------------------ */
/* Settings modal                                                     */
/* ------------------------------------------------------------------ */

function openSettings(message) {
  state.lastFocused = document.activeElement;
  const modal = $('#settingsModal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#apiKeyInput').value = state.apiKey || '';
  $('#apiKeyInput').type = 'password';
  $('#keyToggleBtn').textContent = '显示';
  updateRuntimeUi();
  updateServerCard();

  if (message) showToast(message, true);

  setTimeout(() => {
    const target = state.config?.configured ? $('#modalCloseBtn') : $('#apiKeyInput');
    target?.focus();
  }, 50);
}

function closeSettings() {
  const modal = $('#settingsModal');
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  state.lastFocused?.focus?.();
}

function saveKey() {
  const input = $('#apiKeyInput');
  const key = input.value.trim();

  if (key && key.length < 12) {
    showToast('这个 Key 看起来不完整，请检查后再保存', true);
    input.focus();
    return;
  }

  state.apiKey = key;
  try {
    if (key) sessionStorage.setItem(KEY_STORAGE, key);
    else sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    /* sessionStorage may be unavailable */
  }

  updateConnectionStatus();
  updateServerCard();
  closeSettings();
  showToast(
    key
      ? state.directMode
        ? 'Key 已保存，可以开始直连批改'
        : '临时 Key 已保存，可以开始批改'
      : '临时 Key 已清除'
  );
}

function clearKey() {
  state.apiKey = '';
  $('#apiKeyInput').value = '';
  try {
    sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
  updateConnectionStatus();
  updateServerCard();
  showToast('临时 Key 已清除');
}

function toggleKeyVisibility() {
  const input = $('#apiKeyInput');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  $('#keyToggleBtn').textContent = showing ? '显示' : '隐藏';
}

function trapModalFocus(event) {
  if (event.key !== 'Tab') return;
  const modal = $('#settingsModal .modal');
  const focusable = $$(
    'button:not([disabled]), input:not([disabled]), summary, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
    modal
  ).filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function readSessionKey() {
  try {
    return sessionStorage.getItem(KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */

function countChars(text) {
  return Array.from(String(text || '').replace(/\s/g, '')).length;
}

function splitParagraphs(text) {
  const parts = String(text || '')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [String(text || '').trim()].filter(Boolean);
}

function normalizeSpace(text) {
  return String(text || '').replace(/\s+/g, '');
}

function overlaps(start, end, range) {
  return start < range.end && end > range.start;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return character;
    }
  });
}

function highlightContext(context, wrong) {
  const text = String(context || '');
  const target = String(wrong || '');
  const index = text.indexOf(target);
  if (!target || index < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, index))}<mark>${escapeHtml(target)}</mark>${escapeHtml(
    text.slice(index + target.length)
  )}`;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.classList.toggle('is-error', Boolean(isError));
  toast.hidden = false;
  state.toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3300);
}

class AppError extends Error {
  constructor(message, code = 'ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}
