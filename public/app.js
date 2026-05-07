const topicInput = document.querySelector("#topicInput");
const roundsInput = document.querySelector("#roundsInput");
const speechLimitSelect = document.querySelector("#speechLimitSelect");
const agentCount = document.querySelector("#agentCount");
const startButton = document.querySelector("#startButton");
const newSessionButton = document.querySelector("#newSessionButton");
const insertButton = document.querySelector("#insertButton");
const insertInput = document.querySelector("#insertInput");
const continueRounds = document.querySelector("#continueRounds");
const themeSelect = document.querySelector("#themeSelect");
const saveHistoryButton = document.querySelector("#saveHistoryButton");
const historySelect = document.querySelector("#historySelect");
const aiPosterButton = document.querySelector("#aiPosterButton");
const timeline = document.querySelector("#timeline");
const scrollLatestButton = document.querySelector("#scrollLatestButton");
const statusText = document.querySelector("#statusText");
const currentTopicText = document.querySelector("#currentTopicText");
const sampleTravel = document.querySelector("#sampleTravel");
const sampleCoffee = document.querySelector("#sampleCoffee");
const agentList = document.querySelector("#agentList");

let config = { models: [], personaPresets: [], defaultAgents: [] };
let agents = [];
let transcript = [];
let running = false;
let customPersonas = loadJson("thinking-room-personas", []);
let histories = loadJson("thinking-room-histories", []);
let speechLimit = normalizeInitialSpeechLimit(localStorage.getItem("thinking-room-speech-limit"));
const activeThinking = new Map();
let renderParticipantIndex = 0;
let pendingNotice = null;

timeline.addEventListener("scroll", () => {
  if (isTimelineNearBottom()) hideScrollLatest();
});

scrollLatestButton.addEventListener("click", () => {
  scrollToBottom();
  hideScrollLatest();
});

await init();

async function init() {
  const response = await fetch("/api/config");
  config = await response.json();
  const savedTheme = normalizeTheme(localStorage.getItem("thinking-room-theme") || "archive");
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);
  speechLimitSelect.value = String(speechLimit);

  for (let i = 2; i <= 8; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `${i} 人`;
    if (i === 3) option.selected = true;
    agentCount.append(option);
  }

  agents = defaultAgentsForTier(3);
  renderAgents();
  renderHistories();
  renderEmptyState();
  setSessionActive(false);
  document.body.classList.remove("booting");
  updateButtons();
}

sampleTravel.addEventListener("click", () => {
  topicInput.value = "五一节要不要带娃出游？";
  topicInput.focus();
});

sampleCoffee.addEventListener("click", () => {
  topicInput.value = "每天喝咖啡对人体有没有危害？";
  topicInput.focus();
});

agentCount.addEventListener("change", () => {
  const count = Number(agentCount.value);
  while (agents.length < count) {
    const fallback = defaultAgentsForTier(agents.length + 1)[agents.length] || defaultAgentsForTier(1)[0];
    agents.push({ ...fallback });
  }
  agents = agents.slice(0, count);
  agents = normalizeAgentsForTier(agents);
  renderAgents();
});

themeSelect.addEventListener("change", () => {
  const theme = normalizeTheme(themeSelect.value);
  applyTheme(theme);
  localStorage.setItem("thinking-room-theme", theme);
});

speechLimitSelect.addEventListener("change", () => {
  speechLimit = normalizeSpeechLimit(speechLimitSelect.value);
  speechLimitSelect.value = String(speechLimit);
  localStorage.setItem("thinking-room-speech-limit", String(speechLimit));
  agents = agents.map((agent) => ({ ...agent, maxChars: speechLimit || undefined }));
});

startButton.addEventListener("click", async () => {
  const topic = topicInput.value.trim();
  if (!topic || running) return;

  transcript = [];
  renderParticipantIndex = 0;
  hideScrollLatest();
  timeline.replaceChildren();
  currentTopicText.textContent = topic;
  appendPendingNotice("已提交，正在启动讨论任务。");
  setSessionActive(true);
  await jobRequest("/api/discuss-job", {
    topic,
    rounds: Number(roundsInput.value),
    count: agents.length,
    agents: serializeAgents()
  });
});

newSessionButton.addEventListener("click", () => {
  if (running) return;
  transcript = [];
  renderParticipantIndex = 0;
  insertInput.value = "";
  currentTopicText.textContent = "等待设题";
  hideScrollLatest();
  renderEmptyState();
  setSessionActive(false);
  updateButtons();
  statusText.textContent = "等待话题";
});

saveHistoryButton.addEventListener("click", () => {
  saveCurrentHistory();
});

historySelect.addEventListener("change", () => {
  if (!historySelect.value) return;
  loadHistory(historySelect.value);
});

aiPosterButton.addEventListener("click", async () => {
  const final = [...transcript].reverse().find((item) => item.role === "final");
  const topic = topicInput.value.trim();
  if (!final || !topic || running) return;

  setPosterRunning(true);
  try {
    const response = await fetch("/api/share-poster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, finalText: final.content, transcript })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseApiError(errorText) || `AI生图失败：${response.status}`);
    }
    const blob = await response.blob();
    const extension = imageExtension(blob.type);
    downloadBlob(blob, `石渠-AI生图-${formatDateForFile(new Date())}.${extension}`);
    statusText.textContent = "AI生图已生成";
  } catch (error) {
    statusText.textContent = error.message || "AI生图失败";
  } finally {
    setPosterRunning(false);
  }
});

insertButton.addEventListener("click", async () => {
  const topic = topicInput.value.trim();
  const userInput = insertInput.value.trim();
  if (!topic || !userInput || running) return;

  removeConclusionTail();
  appendUserMessage(userInput);
  insertInput.value = "";
  await jobRequest("/api/turn-job", {
    topic,
    userInput,
    transcript,
    rounds: Number(continueRounds.value),
    count: agents.length,
    agents: serializeAgents(),
    agentIndex: nextAgentIndex()
  });
});

async function jobRequest(url, payload) {
  setRunning(true);
  let cursor = 0;
  let emptyPolls = 0;
  try {
    const startResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const startData = await startResponse.json().catch(() => ({}));
    if (!startResponse.ok || !startData.jobId) {
      throw new Error(startData.error || `请求失败：${startResponse.status}`);
    }

    updatePendingNotice("任务已启动，正在等待第一位模型思考。");
    while (true) {
      const pollResponse = await fetch(`/api/jobs/${encodeURIComponent(startData.jobId)}?after=${cursor}`, {
        cache: "no-store"
      });
      const pollData = await pollResponse.json().catch(() => ({}));
      if (!pollResponse.ok) throw new Error(pollData.error || `任务查询失败：${pollResponse.status}`);

      const events = Array.isArray(pollData.events) ? pollData.events : [];
      for (const event of events) {
        cursor = Math.max(cursor, Number(event.seq) || cursor);
        handleEvent(event.type, event);
      }

      if (pollData.done) break;
      if (!events.length) {
        emptyPolls += 1;
        if (emptyPolls === 8) updatePendingNotice("模型还在思考，页面会自动刷新新消息。");
      } else {
        emptyPolls = 0;
      }
      await delay(900);
    }
  } catch (error) {
    removePendingNotice();
    appendMessage({
      role: "moderator",
      agentName: "系统",
      agentTitle: "错误",
      avatar: "!",
      content: error.message || "请求失败"
    });
    statusText.textContent = "发生错误";
  } finally {
    setRunning(false);
  }
}

async function streamRequest(url, payload, options = {}) {
  setRunning(true);
  let receivedFrame = false;
  let fallbackMode = false;
  const controller = new AbortController();
  const slowTimer = window.setTimeout(() => {
    if (pendingNotice) {
      updatePendingNotice("请求已发出，正在等模型返回。远程访问下这里可能不会逐字刷新。");
    }
  }, 6000);
  const fallbackTimer = window.setTimeout(() => {
    if (!receivedFrame && options.fallbackUrl) {
      fallbackMode = true;
      controller.abort();
    }
  }, 10000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok || !response.body) throw new Error(`请求失败：${response.status}`);
    await readSse(response.body, () => {
      receivedFrame = true;
    });
  } catch (error) {
    if (fallbackMode && options.fallbackUrl) {
      await batchRequest(options.fallbackUrl, payload);
      return;
    }
    removePendingNotice();
    appendMessage({
      role: "moderator",
      agentName: "系统",
      agentTitle: "错误",
      avatar: "!",
      content: error.message || "请求失败"
    });
    statusText.textContent = "发生错误";
  } finally {
    window.clearTimeout(slowTimer);
    window.clearTimeout(fallbackTimer);
    setRunning(false);
  }
}

async function batchRequest(url, payload) {
  updatePendingNotice("当前访问通道不支持实时刷新，已切换兼容模式。模型会继续思考，完成后一次性显示。");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `请求失败：${response.status}`);
  const events = Array.isArray(data.events) ? data.events : [];
  if (!events.length) throw new Error("兼容模式没有返回讨论内容");
  for (const event of events) {
    handleEvent(event.type, event);
  }
}

async function readSse(body, onFrame = () => {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const event = handleSseFrame(frame);
      if (event && event !== "meta") onFrame();
    }
  }
}

function handleSseFrame(frame) {
  const eventLine = frame.split("\n").find((line) => line.startsWith("event:"));
  const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
  if (!eventLine || !dataLine) return;

  const event = eventLine.replace("event:", "").trim();
  const payload = JSON.parse(dataLine.replace("data:", "").trim());
  handleEvent(event, payload);
  return event;
}

function handleEvent(event, payload) {
  if (event === "status") {
    removePendingNotice();
    statusText.textContent = payload.content;
    return;
  }
  if (event === "round") {
    statusText.textContent = "持续推演中";
    return;
  }
  if (event === "thinking") {
    appendThinking(payload);
    statusText.textContent = payload.content;
    return;
  }
  if (event === "message" || event === "final") {
    removeThinking(payload);
    appendMessage(payload);
    transcript.push(compactMessage(payload));
    statusText.textContent = event === "final" ? "讨论结束" : `${payload.agentName} 发言`;
    updateButtons();
    return;
  }
  if (event === "notice") {
    removeThinking(payload);
    appendMessage(payload);
    statusText.textContent = payload.content || "继续等待";
    return;
  }
  if (event === "vote") {
    transcript.push(compactMessage(payload));
    statusText.textContent = "模型投票已记录";
    return;
  }
  if (event === "done") {
    statusText.textContent = "等待下一步";
    return;
  }
  if (event === "error") {
    clearThinking();
    removePendingNotice();
    appendMessage({
      role: "moderator",
      agentName: "系统",
      agentTitle: "错误",
      avatar: "!",
      content: payload.message || "请求失败"
    });
    statusText.textContent = "发生错误";
  }
}

function renderAgents() {
  agentList.replaceChildren();
  agents = normalizeAgentsForTier(agents);

  agents.forEach((agent, index) => {
    const row = document.createElement("article");
    row.className = "agent-row";

    const avatar = document.createElement("div");
    avatar.className = "avatar preview-avatar";
    avatar.textContent = agent.avatar || `${index + 1}`;

    const body = document.createElement("div");
    body.className = "agent-config";

    const top = document.createElement("div");
    top.className = "agent-config-top";

    const modelSelect = document.createElement("select");
    for (const model of modelsForCurrentTier()) {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${model.label}${model.webSearch ? " · 可联网" : ""}`;
      option.disabled = !model.available;
      option.selected = model.id === agent.clientId;
      modelSelect.append(option);
    }
    modelSelect.addEventListener("change", () => {
      agents[index].clientId = modelSelect.value;
      const model = config.models.find((item) => item.id === modelSelect.value);
      agents[index].name = model?.label || agents[index].name;
      agents[index].title = model ? `${model.provider} · ${model.model}` : "模型";
      if (!agents[index].presetId) agents[index].avatar = avatarForModel(model, index);
      renderAgents();
    });

    const presetSelect = document.createElement("select");
    presetSelect.append(new Option("无默认人设", ""));
    for (const preset of config.personaPresets) {
      const option = new Option(`${preset.icon} ${preset.name}`, preset.id);
      option.selected = preset.id === agent.presetId;
      presetSelect.append(option);
    }
    for (const personaItem of customPersonas) {
      const option = new Option(`自定义 ${personaItem.name}`, `custom:${personaItem.id}`);
      option.selected = option.value === agent.presetId;
      presetSelect.append(option);
    }
    presetSelect.append(new Option("新建自定义人设...", "__new_custom__"));
    presetSelect.addEventListener("change", async () => {
      const model = config.models.find((item) => item.id === agents[index].clientId);

      if (presetSelect.value === "__new_custom__") {
        const prompt = window.prompt("输入这个参与者的人设、性格或说话风格：", "");
        if (!prompt?.trim()) {
          renderAgents();
          return;
        }
        const name = window.prompt("给这个人设起个名字：", `人设 ${customPersonas.length + 1}`);
        const item = {
          id: String(Date.now()),
          name: name?.trim() || `人设 ${customPersonas.length + 1}`,
          icon: "人",
          prompt: prompt.trim()
        };
        customPersonas.unshift(item);
        localStorage.setItem("thinking-room-personas", JSON.stringify(customPersonas));
        agents[index].presetId = `custom:${item.id}`;
        agents[index].persona = item.prompt;
        agents[index].avatar = item.icon;
        renderAgents();
        return;
      }

      const preset = config.personaPresets.find((item) => item.id === presetSelect.value);
      const custom = customPersonas.find((item) => `custom:${item.id}` === presetSelect.value);
      agents[index].presetId = presetSelect.value;
      agents[index].persona = custom?.prompt || "";
      agents[index].avatar = preset?.icon || custom?.icon || avatarForModel(model, index);
      renderAgents();
    });

    top.append(modelSelect, presetSelect);
    body.append(top);
    row.append(avatar, body);
    agentList.append(row);
  });
}

function appendMessage(message) {
  removePendingNotice();
  const article = document.createElement("article");
  const side = message.role === "participant" ? sideForNextParticipant() : "center";
  article.className = `message ${message.role || ""} ${side}`;
  if (message.agentTitle === "一句补充") article.classList.add("supplement");
  article.style.setProperty("--agent-color", colorForMessage(message));

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = message.avatar || message.agentName?.slice(0, 1) || "?";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const head = document.createElement("div");
  head.className = "message-head";
  const name = document.createElement("strong");
  name.textContent = message.agentName || "AI";
  const title = document.createElement("span");
  title.textContent = message.agentTitle || "";
  const time = document.createElement("span");
  time.className = "duration";
  time.textContent = formatDuration(message.durationMs);

  const content = document.createElement("div");
  content.className = "content";
  if (message.role === "final") {
    content.classList.add("final-board");
    content.innerHTML = renderMarkdownLite(message.content || "");
  } else if (message.role === "participant" && message.agentTitle !== "一句补充") {
    content.classList.add("thought-content");
    content.innerHTML = renderThoughtContent(message.content || "");
  } else {
    content.textContent = message.content || "";
  }

  head.append(name, title);
  if (time.textContent) head.append(time);
  bubble.append(head, content);
  article.append(avatar, bubble);
  appendTimelineNode(article);
  if (message.role === "participant") renderParticipantIndex += 1;
}

function appendThinking(message) {
  removePendingNotice();
  const key = thinkingKey(message);
  removeThinking(message);

  const article = document.createElement("article");
  const side = message.role === "participant" ? sideForNextParticipant() : "center";
  article.className = `message thinking ${side}`;
  article.style.setProperty("--agent-color", colorForMessage(message));

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = message.avatar || message.agentName?.slice(0, 1) || "?";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const head = document.createElement("div");
  head.className = "message-head";
  const name = document.createElement("strong");
  name.textContent = message.agentName || "AI";
  const title = document.createElement("span");
  title.textContent = message.agentTitle || "";
  const timer = document.createElement("span");
  timer.className = "duration";
  timer.textContent = "0s";
  head.append(name, title, timer);

  const content = document.createElement("div");
  content.className = "content thinking-content";
  content.innerHTML = `<span>${escapeHtml(message.content || `${message.agentName} 正在思考`)}</span><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;

  bubble.append(head, content);
  article.append(avatar, bubble);
  appendTimelineNode(article);

  const startedAt = Date.now();
  const intervalId = window.setInterval(() => {
    timer.textContent = formatDuration(Date.now() - startedAt);
  }, 500);
  activeThinking.set(key, { node: article, intervalId });
}

function removeThinking(message) {
  const keys = [thinkingKey(message)];
  if (message.role === "final") keys.push("final");
  for (const key of keys) {
    const item = activeThinking.get(key);
    if (!item) continue;
    window.clearInterval(item.intervalId);
    item.node.remove();
    activeThinking.delete(key);
  }
}

function clearThinking() {
  for (const item of activeThinking.values()) {
    window.clearInterval(item.intervalId);
    item.node.remove();
  }
  activeThinking.clear();
}

function thinkingKey(message) {
  return message.agentId || message.role || "thinking";
}

function appendUserMessage(content) {
  const message = {
    role: "user",
    agentId: "user",
    agentName: "我",
    agentTitle: "插入讨论",
    avatar: "我",
    content
  };
  appendMessage(message);
  transcript.push(compactMessage(message));
}

function appendRound(text) {
  const node = document.createElement("div");
  node.className = "round-marker";
  node.textContent = text;
  appendTimelineNode(node);
}

function renderEmptyState() {
  hideScrollLatest();
  clearThinking();
  removePendingNotice();
  renderParticipantIndex = 0;
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = "开始后，掌议人会先开题，谋士依次献策，最后形成定案札记。";
  timeline.replaceChildren(node);
}

function appendPendingNotice(text) {
  removePendingNotice();
  const node = document.createElement("article");
  node.className = "message moderator center pending-notice";
  node.innerHTML = [
    '<div class="avatar">…</div>',
    '<div class="bubble">',
    '<div class="message-head"><strong>系统</strong><span>连接中</span></div>',
    `<div class="content">${escapeHtml(text)}</div>`,
    "</div>"
  ].join("");
  pendingNotice = node;
  appendTimelineNode(node);
  statusText.textContent = "连接中";
}

function updatePendingNotice(text) {
  const content = pendingNotice?.querySelector(".content");
  if (content) content.textContent = text;
  statusText.textContent = "等待模型";
}

function removePendingNotice() {
  if (!pendingNotice) return;
  pendingNotice.remove();
  pendingNotice = null;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function serializeAgents() {
  return agents.map((agent) => ({
    clientId: agent.clientId,
    persona: agent.persona || "",
    presetId: agent.presetId || "",
    voiceIndex: agent.voiceIndex,
    maxChars: speechLimit || agent.maxChars || undefined
  }));
}

function compactMessage(message) {
  return {
    type: message.type,
    role: message.role,
    agentId: message.agentId,
    agentName: message.agentName,
    agentTitle: message.agentTitle,
    avatar: message.avatar,
    round: message.round,
    durationMs: message.durationMs,
    content: message.content,
    stance: message.stance,
    reason: message.reason,
    action: message.action
  };
}

function nextAgentIndex() {
  const participantCount = transcript.filter((item) => item.role === "participant").length;
  return participantCount % agents.length;
}

function sideForNextParticipant() {
  return renderParticipantIndex % 2 === 1 ? "right" : "left";
}

function removeConclusionTail() {
  if (!transcript.some((item) => item.role === "final" || item.role === "vote" || item.agentTitle === "一句补充")) return;
  transcript = transcript.filter((item) => item.role !== "final" && item.role !== "vote" && item.agentTitle !== "一句补充");
  timeline.querySelectorAll(".message.final, .message.supplement").forEach((node) => node.remove());
  updateButtons();
}

function setRunning(value) {
  running = value;
  startButton.disabled = value;
  insertButton.disabled = value || transcript.length === 0;
  const hasFinal = transcript.some((item) => item.role === "final");
  saveHistoryButton.disabled = value || !hasFinal;
  aiPosterButton.disabled = value || !hasFinal;
  saveHistoryButton.hidden = value || !hasFinal;
  aiPosterButton.hidden = value || !hasFinal;
  newSessionButton.disabled = value || (transcript.length === 0 && !document.body.classList.contains("in-session"));
  startButton.textContent = value ? "思考中" : "开始";
  if (!value) clearThinking();
}

function updateButtons() {
  insertButton.disabled = running || transcript.length === 0;
  const hasFinal = transcript.some((item) => item.role === "final");
  saveHistoryButton.disabled = running || !hasFinal;
  aiPosterButton.disabled = running || !hasFinal;
  saveHistoryButton.hidden = running || !hasFinal;
  aiPosterButton.hidden = running || !hasFinal;
  newSessionButton.disabled = running || (transcript.length === 0 && !document.body.classList.contains("in-session"));
}

function modelsForCurrentTier() {
  const available = config.models.filter((model) => model.available);
  return available.length ? available : config.models;
}

function defaultAgentsForTier(count = 3) {
  const models = modelsForCurrentTier();
  const fallbackModels = models.length ? models : config.models.filter((model) => model.available);
  return Array.from({ length: count }, (_, index) => {
    const model = fallbackModels[index % fallbackModels.length] || {};
    return {
      id: `agent-${index + 1}`,
      name: model.label || `AI ${index + 1}`,
      title: "谋士",
      avatar: avatarForModel(model, index),
      clientId: model.id,
      persona: "",
      presetId: "",
      voiceIndex: index,
      maxChars: speechLimit || undefined
    };
  });
}

function normalizeAgentsForTier(rawAgents = []) {
  const models = modelsForCurrentTier();
  if (!models.length) return rawAgents;
  return rawAgents.map((agent, index) => {
    const currentModel = models.find((model) => model.id === agent.clientId);
    const model = currentModel || models[index % models.length];
    return {
      ...agent,
      id: `agent-${index + 1}`,
      name: model.label || agent.name || `AI ${index + 1}`,
      title: agent.presetId ? agent.title || "谋士" : "谋士",
      clientId: model.id,
      avatar: agent.presetId ? agent.avatar : avatarForModel(model, index),
      voiceIndex: Number.isFinite(Number(agent.voiceIndex)) ? Number(agent.voiceIndex) : index,
      maxChars: speechLimit || normalizeSpeechLimit(agent.maxChars || 0) || undefined
    };
  });
}

function setSessionActive(value) {
  document.body.classList.toggle("in-session", value);
}

function setPosterRunning(value) {
  aiPosterButton.disabled = value;
  aiPosterButton.textContent = value ? "生成中" : "AI生图";
  if (value) statusText.textContent = "正在调用 RunningHub 生图";
  else updateButtons();
}

function parseApiError(text) {
  try {
    return JSON.parse(text)?.error || "";
  } catch {
    return String(text || "").slice(0, 120);
  }
}

function imageExtension(type) {
  if (String(type).includes("jpeg")) return "jpg";
  if (String(type).includes("webp")) return "webp";
  return "png";
}

function defaultAvatar(index) {
  return ["一", "二", "三", "四", "五", "六", "七", "八"][index] || "AI";
}

function avatarForModel(model = {}, index = 0) {
  const label = `${model?.label || ""} ${model?.model || ""}`.toLowerCase();
  if (label.includes("mimo")) return "米";
  if (label.includes("gemini")) return "G";
  if (label.includes("gpt")) return "5";
  if (label.includes("deepseek")) return "深";
  if (label.includes("kimi")) return "K";
  if (label.includes("qwen")) return "千";
  if (label.includes("glm")) return "智";
  if (label.includes("minimax")) return "M";
  return defaultAvatar(index);
}

function scrollToBottom() {
  timeline.scrollTop = timeline.scrollHeight;
}

function appendTimelineNode(node) {
  const shouldFollow = isTimelineNearBottom();
  timeline.append(node);
  if (shouldFollow) {
    scrollToBottom();
  } else {
    showScrollLatest();
  }
}

function isTimelineNearBottom() {
  const distance = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
  return distance < 96;
}

function showScrollLatest() {
  scrollLatestButton.hidden = false;
}

function hideScrollLatest() {
  scrollLatestButton.hidden = true;
}

function renderThoughtContent(text) {
  const clean = String(text || "").trim();
  const match = clean.match(/^(.{8,70}?[。！？!?])([\s\S]*)$/);
  if (!match) return escapeHtml(clean);
  const lead = match[1].trim();
  const rest = match[2].trim();
  if (!rest) return escapeHtml(clean);
  return [
    `<p class="message-lead">${escapeHtml(lead)}</p>`,
    `<p>${escapeHtml(rest)}</p>`
  ].join("");
}

function colorForMessage(message = {}) {
  if (message.role === "moderator" || message.role === "final") return "var(--host)";
  if (message.role === "user") return "var(--user)";
  const key = `${message.agentId || ""}${message.agentName || ""}`;
  const palette = ["#2f6f55", "#7a5c22", "#3e6f8f", "#8a4f5f", "#5a658c", "#6e6535", "#27716f", "#744f8f"];
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function saveCurrentHistory() {
  const topic = topicInput.value.trim();
  if (!topic || transcript.length === 0) return;
  const item = {
    id: String(Date.now()),
    topic,
    agents: serializeAgents(),
    count: agents.length,
    speechLimit,
    transcript,
    savedAt: new Date().toISOString(),
    theme: themeSelect.value
  };
  histories = [item, ...histories].slice(0, 40);
  localStorage.setItem("thinking-room-histories", JSON.stringify(histories));
  renderHistories();
  historySelect.value = item.id;
  statusText.textContent = "已保存";
}

function renderHistories() {
  historySelect.replaceChildren(new Option("历史记录", ""));
  histories.forEach((item, index) => {
    const date = new Date(item.savedAt);
    const label = `${index + 1}. ${date.getMonth() + 1}/${date.getDate()} ${item.topic.slice(0, 8)}`;
    historySelect.append(new Option(label, item.id));
  });
}

function loadHistory(id) {
  const item = histories.find((history) => history.id === id);
  if (!item) return;
  topicInput.value = item.topic;
  currentTopicText.textContent = item.topic;
  agentCount.value = String(item.count || item.agents?.length || 3);
  speechLimit = normalizeSpeechLimit(item.speechLimit || item.agents?.[0]?.maxChars || 0);
  speechLimitSelect.value = String(speechLimit);
  agents = (item.agents || []).map((agent, index) => ({
    ...config.defaultAgents[index % config.defaultAgents.length],
    ...agent
  }));
  agents = normalizeAgentsForTier(agents);
  transcript = item.transcript || [];
  if (item.theme) {
    themeSelect.value = item.theme;
    applyTheme(item.theme);
  }
  renderAgents();
  hideScrollLatest();
  timeline.replaceChildren();
  renderParticipantIndex = 0;
  for (const message of transcript) {
    if (message.role !== "vote") appendMessage(message);
  }
  setSessionActive(true);
  updateButtons();
  statusText.textContent = "历史已加载，可继续聊";
}

function normalizeSpeechLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Math.max(Math.round(number), 80), 800);
}

function normalizeInitialSpeechLimit(value) {
  const normalized = normalizeSpeechLimit(value);
  return normalized || 300;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = normalizeTheme(theme);
}

function normalizeTheme(theme) {
  const allowed = ["archive", "noir", "astrolabe", "warroom"];
  if (theme === "paper" || theme === "tea") return "archive";
  if (theme === "night") return "noir";
  if (theme === "terminal") return "astrolabe";
  return allowed.includes(theme) ? theme : "archive";
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

function formatDuration(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "";
  const seconds = Number(value) / 1000;
  if (seconds < 1) return `${Math.round(Number(value))}ms`;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
}

function renderMarkdownLite(rawText) {
  const lines = String(rawText || "").split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];
  let index = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      flushList();
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      flushParagraph();
      flushList();
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      html.push(renderTable(tableLines));
      continue;
    }

    const heading = line.replace(/^#{1,4}\s*/, "");
    if (/^(📌|👥|🧭|🎯|定案|理由|谋士分布|各家短评|下一步|结论|立刻做|统计|模型意见|模型观点|观点分布|最终建议)/.test(heading)) {
      flushParagraph();
      flushList();
      html.push(`<h3>${inlineMarkdown(heading)}</h3>`);
      index += 1;
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      flushParagraph();
      list.push(listMatch[1]);
      index += 1;
      continue;
    }

    flushList();
    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  flushList();
  return html.join("");
}

function isTableStart(lines, index) {
  return lines[index]?.trim().startsWith("|") && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(lines[index + 1]?.trim() || "");
}

function renderTable(tableLines) {
  const rows = tableLines
    .filter((line) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean));
  if (!rows.length) return "";
  const [head, ...body] = rows;
  return [
    "<table>",
    `<thead><tr>${head.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>`,
    `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`,
    "</table>"
  ].join("");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function buildShareSvg({ topic, finalText, messages }) {
  const parsed = parseFinalSummary(finalText, messages);
  const width = 1080;
  const palette = getSharePalette();
  const parts = [];
  let y = 92;

  parts.push(`<text x="88" y="${y}" class="title">石渠</text>`);
  y += 52;
  parts.push(`<text x="90" y="${y}" class="sub">${escapeSvg(parsed.date)} · ${parsed.modelCount} 位谋士议事 · 定案札记</text>`);
  y += 48;

  const topicLines = splitTextForSvg(topic || "未命名话题", 22).slice(0, 3);
  const topicHeight = 58 + topicLines.length * 48;
  parts.push(`<rect x="86" y="${y}" width="908" height="${topicHeight}" rx="24" fill="${palette.topicBg}" stroke="${palette.line}"/>`);
  parts.push(topicLines.map((line, index) => (
    `<text x="120" y="${y + 60 + index * 48}" class="topic">${escapeSvg(line)}</text>`
  )).join(""));
  y += topicHeight + 52;

  parts.push(`<text x="88" y="${y}" class="section">定案</text>`);
  y += 46;
  const decisionLines = splitTextForSvg(parsed.decision, 24);
  const decisionHeight = 54 + decisionLines.length * 46;
  parts.push(`<rect x="86" y="${y}" width="908" height="${decisionHeight}" rx="26" fill="${palette.adviceBg}" stroke="${palette.line}"/>`);
  parts.push(decisionLines.map((line, index) => (
    `<text x="124" y="${y + 62 + index * 46}" class="decision">${escapeSvg(line)}</text>`
  )).join(""));
  y += decisionHeight + 42;

  parts.push(`<text x="88" y="${y}" class="section">关键理由</text>`);
  y += 44;
  for (const item of parsed.reasons.slice(0, 3)) {
    const lines = splitTextForSvg(cleanMarkdown(item), 30);
    parts.push(`<circle cx="106" cy="${y - 7}" r="7" fill="${palette.accent}"/>`);
    parts.push(lines.map((line, lineIndex) => (
      `<text x="132" y="${y + lineIndex * 34}" class="bullet">${escapeSvg(line)}</text>`
    )).join(""));
    y += Math.max(48, lines.length * 34 + 16);
  }

  y += 26;
  parts.push(`<text x="88" y="${y}" class="section">谋士分布</text>`);
  y += 48;
  parsed.rows.slice(0, 4).forEach((row, index) => {
    const view = cleanMarkdown(row.view || row[0] || "观点");
    const actionLines = splitTextForSvg(cleanMarkdown(row.action || row[2] || ""), 31);
    const rowHeight = 92 + Math.max(0, actionLines.length - 1) * 30;
    parts.push(`<rect x="86" y="${y}" width="908" height="${rowHeight}" rx="18" fill="${index % 2 ? palette.rowAlt : palette.row}" stroke="${palette.line}"/>`);
    parts.push(`<text x="120" y="${y + 38}" class="row-title">${escapeSvg(view)}</text>`);
    parts.push(actionLines.map((line, lineIndex) => (
      `<text x="120" y="${y + 72 + lineIndex * 30}" class="row-body">${escapeSvg(line)}</text>`
    )).join(""));
    parts.push(`<rect x="804" y="${y + Math.round((rowHeight - 48) / 2)}" width="154" height="48" rx="24" fill="${palette.badge}"/>`);
    parts.push(`<text x="881" y="${y + Math.round(rowHeight / 2) + 9}" text-anchor="middle" class="badge-text">${escapeSvg(cleanMarkdown(row.count || row[1] || ""))}</text>`);
    y += rowHeight + 22;
  });

  y += 24;
  parts.push(`<text x="88" y="${y}" class="section">各家短评</text>`);
  y += 44;
  for (const item of parsed.comments.slice(0, 5)) {
    const lines = splitTextForSvg(cleanMarkdown(item), 31);
    parts.push(lines.map((line, lineIndex) => (
      `<text x="106" y="${y + lineIndex * 32}" class="comment">${escapeSvg(line)}</text>`
    )).join(""));
    y += Math.max(42, lines.length * 32 + 10);
  }

  y += 20;
  const nextLines = parsed.nextSteps.slice(0, 3).flatMap((item) => splitTextForSvg(cleanMarkdown(item), 28));
  const nextHeight = 50 + nextLines.length * 38;
  parts.push(`<rect x="86" y="${y}" width="908" height="${nextHeight}" rx="24" fill="${palette.topicBg}" stroke="${palette.line}"/>`);
  parts.push(`<text x="120" y="${y + 40}" class="row-title">下一步</text>`);
  parts.push(nextLines.map((line, index) => (
    `<text x="120" y="${y + 82 + index * 38}" class="row-body">${escapeSvg(line)}</text>`
  )).join(""));
  y += nextHeight + 44;
  parts.push(`<text x="88" y="${y}" class="foot">由石渠生成 · 高阶智能体的思辨推演</text>`);

  const height = Math.max(1440, y + 70);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .title{font:700 54px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.ink}}
      .sub{font:400 28px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.muted}}
      .topic{font:500 30px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.ink}}
      .section{font:700 30px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.accentDark}}
      .decision{font:700 34px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.ink}}
      .bullet{font:400 27px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.ink}}
      .row-title{font:700 28px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.ink}}
      .row-body{font:400 24px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.muted}}
      .comment{font:400 25px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.ink}}
      .badge-text{font:700 24px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.badgeText}}
      .advice{font:600 32px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.ink}}
      .foot{font:400 22px "PingFang SC","Microsoft YaHei",sans-serif;fill:${palette.muted}}
    </style>
  </defs>
  <rect width="1080" height="${height}" fill="${palette.bg}"/>
  <circle cx="1000" cy="90" r="160" fill="${palette.soft}" opacity="0.75"/>
  <circle cx="68" cy="${height - 130}" r="190" fill="${palette.soft2}" opacity="0.72"/>
  <rect x="54" y="54" width="972" height="${height - 108}" rx="42" fill="${palette.paper}" stroke="${palette.line}" stroke-width="2"/>
  ${parts.join("\n")}
</svg>`;
}

function parseFinalSummary(finalText, messages) {
  const text = String(finalText || "");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections = parseFinalSections(lines);
  const tableStart = lines.findIndex((line, index) => isTableStart(lines, index));
  const rows = tableStart >= 0 ? parseTableRows(lines.slice(tableStart)) : [];
  const decision = normalizeSectionText(sections["定案"]) || text.replace(/\s+/g, " ").slice(0, 160);
  const reasons = normalizeSectionList(sections["理由"]);
  const comments = normalizeSectionList(sections["各家短评"]);
  const nextSteps = normalizeSectionList(sections["下一步"]);
  const distributionText = normalizeSectionText(sections["谋士分布"]);

  return {
    decision,
    reasons: reasons.length ? reasons : [decision],
    rows: rows.length ? rows : fallbackRows(messages, distributionText),
    comments: comments.length ? comments : fallbackComments(messages),
    nextSteps: nextSteps.length ? nextSteps : ["先按定案做一个小动作，再根据反馈继续议事。"],
    modelCount: new Set((messages || []).filter((item) => item.role === "participant").map((item) => item.agentName)).size || 0,
    date: new Date().toLocaleDateString("zh-CN")
  };
}

function parseFinalSections(lines) {
  const sections = {};
  let current = "";
  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s*(定案|理由|谋士分布|各家短评|下一步)\s*$/)?.[1];
    if (heading) {
      current = heading;
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(line);
  }
  return sections;
}

function normalizeSectionText(lines = []) {
  return lines
    .filter((line) => !line.startsWith("|") && !/^\|?\s*:?-{2,}:?/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ""))
    .map(cleanMarkdown)
    .filter(Boolean)
    .join(" ");
}

function normalizeSectionList(lines = []) {
  const items = [];
  for (const line of lines) {
    if (line.startsWith("|") || /^\|?\s*:?-{2,}:?/.test(line)) continue;
    const cleaned = cleanMarkdown(line.replace(/^[-*]\s+/, ""));
    if (cleaned) items.push(cleaned);
  }
  return items;
}

function parseTableRows(lines) {
  const tableLines = [];
  for (const line of lines) {
    if (!line.startsWith("|")) break;
    tableLines.push(line);
  }
  const rows = tableLines
    .filter((line) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim().replace(/\*\*/g, "")).filter(Boolean));
  return rows.slice(1).map((row) => ({
    view: row[0],
    count: row[1],
    action: row[2]
  }));
}

function fallbackRows(messages, distributionText = "") {
  const names = [...new Set((messages || []).filter((item) => item.role === "participant").map((item) => item.agentName))];
  return [
    { view: "主要倾向", count: `${names.length || 0} 位`, action: distributionText || "围绕共同结论收束，保留关键例外。" }
  ];
}

function fallbackComments(messages) {
  return [...new Set((messages || []).filter((item) => item.role === "participant").map((item) => item.agentName))]
    .slice(0, 4)
    .map((name) => `${name}：意见已纳入定案。`);
}

function getSharePalette() {
  return {
    bg: "#efe8da",
    paper: "#fffaf0",
    topicBg: "#f4ead8",
    row: "#fff7e8",
    rowAlt: "#f7eddc",
    line: "#d8c8ad",
    ink: "#27221b",
    muted: "#776b5a",
    accent: "#a05a2c",
    accentDark: "#70431f",
    badge: "#2f5b45",
    badgeText: "#fffaf0",
    adviceBg: "#efe0c4",
    soft: "#ead3a8",
    soft2: "#d7e0c3"
  };
}

function splitTextForSvg(text, maxChars) {
  const clean = text.replace(/\s+/g, " ").trim();
  const lines = [];
  for (let index = 0; index < clean.length; index += maxChars) {
    lines.push(clean.slice(index, index + maxChars));
  }
  return lines.length ? lines : [""];
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function svgToPngBlob(svg) {
  const size = parseSvgSize(svg);
  const image = await loadSvgImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#efe8da";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, size.width, size.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas export failed"));
    }, "image/png", 0.96);
  });
}

function loadSvgImage(svg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg image load failed"));
    };
    image.src = url;
  });
}

function parseSvgSize(svg) {
  const width = Number(svg.match(/\swidth="(\d+)"/)?.[1] || 1080);
  const height = Number(svg.match(/\sheight="(\d+)"/)?.[1] || 1440);
  return { width, height };
}

function formatDateForFile(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function clampText(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function cleanMarkdown(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^[-*]\s+/, "")
    .trim();
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeSvg(text) {
  return escapeHtml(text);
}
