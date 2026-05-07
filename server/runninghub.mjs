const RUNNINGHUB_BASE_URL = "https://www.runninghub.cn/openapi/v2";

export function buildRunningHubPosterPrompt({ topic, finalText, transcript = [] }) {
  const modelViews = summarizeModelViews(transcript);
  const finalSummary = compactPosterText(normalizeHostWording(finalText), 110);

  return [
    "生成一张高级中文信息展板，竖版 9:16，适合保存和朋友圈分享，第一目标是文字完整清晰、一眼看懂。",
    "主题是多人 AI 思辨后的决策提炼，不是聊天截图，不是电影海报，不要夸张 AI 科幻感。",
    "视觉风格：博物馆展陈图文板 + 高级杂志信息图，干净、克制、网格清晰，重点是信息排版。",
    "这是信息展板，不是绘画海报。只允许 4 个文字区：标题区、话题区、最终判断区、模型短评区。",
    "禁止额外生成小标签、小卡片、右侧便签、页脚长句、英文装饰字、logo 说明、AI Collective Wisdom 等无关文字。",
    "禁止任何被裁切、压缩、变形、半句、乱码、错别字、以省略号结尾的文字；如果放不下，删掉次要文字，不要缩小字号硬塞。",
    "所有中文必须横排、完整、清晰；最小字号也要像手机截图里 28px 以上的大字。",
    "版式：顶部是“石渠”和短副标题；中部用最大字号放最终判断；下方用 2-3 行列出模型短评。",
    "行动建议最多 1 条，必须放在最终判断区内完整显示，不要做成单独右侧小卡片。",
    "不要大场景绘画，不要人物背影，不要火焰、光束、巨大符号、过度戏剧化背景。",
    "总字数约 90-140 个中文，只保留核心信息；宁可少字、留白，也不要密集段落。",
    "必须避免乱码、错别字、伪二维码、复杂表格。可以出现大标题：石渠。",
    "票面只能使用结论文本里出现的模型数、模型名和立场；禁止发明百分比，禁止出现 42%、33%、25% 这类比例，除非原文明确给出。",
    "模型名必须使用短名，例如 MiMo V2.5 Pro、MiMo V2.5、MiMo V2 Pro，不要写供应商和完整接口名。",
    "模型短评最多 3 行，每行格式是：模型短名 + 8-14 字短评。不要把模型短评做成三列长段落。",
    "信息层级参考：最大字=最终判断；中等字=精确票面，例如“3/3 全体一致”；小字=模型短评，但也必须清晰可读。",
    `讨论话题：${compactPosterText(topic, 100)}`,
    `结论提炼：${finalSummary}`,
    modelViews ? `模型观点：${modelViews}` : "",
    "整体观感要像专业展览说明牌和公众号长图封面之间的高级信息板，不要像 AI 生成海报。"
  ].filter(Boolean).join("\n");
}

export async function createRunningHubPoster({
  apiKey,
  topic,
  finalText,
  transcript,
  fetchImpl = fetch,
  signal,
  pollIntervalMs = 3000,
  timeoutMs = 180000
}) {
  if (!apiKey) throw new Error("RunningHub API Key 未配置");

  const prompt = buildRunningHubPosterPrompt({ topic, finalText, transcript });
  const task = await postJson({
    fetchImpl,
    url: `${RUNNINGHUB_BASE_URL}/rhart-image-g-2/text-to-image`,
    apiKey,
    body: {
      prompt,
      aspectRatio: "9:16",
      resolution: "1k"
    },
    signal
  });

  if (!task.taskId) {
    throw new Error(`RunningHub 未返回 taskId：${task.errorMessage || "unknown error"}`);
  }

  const result = await pollRunningHubTask({
    apiKey,
    taskId: task.taskId,
    fetchImpl,
    signal,
    pollIntervalMs,
    timeoutMs
  });
  const image = result.results?.find((item) => item.url && /png|jpg|jpeg|webp/i.test(item.outputType || item.url));
  if (!image?.url) throw new Error("RunningHub 未返回图片结果");

  const imageResponse = await fetchImpl(image.url, { signal });
  if (!imageResponse.ok) throw new Error(`下载 RunningHub 图片失败：${imageResponse.status}`);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  return {
    buffer,
    contentType: contentTypeFor(image.outputType),
    taskId: task.taskId,
    prompt
  };
}

export async function pollRunningHubTask({
  apiKey,
  taskId,
  fetchImpl = fetch,
  signal,
  pollIntervalMs = 3000,
  timeoutMs = 180000
}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const payload = await postJson({
      fetchImpl,
      url: `${RUNNINGHUB_BASE_URL}/query`,
      apiKey,
      body: { taskId },
      signal
    });

    if (payload.status === "SUCCESS") return payload;
    if (payload.status === "FAILED") {
      throw new Error(`RunningHub 生成失败：${payload.errorMessage || JSON.stringify(payload.failedReason || {})}`);
    }
    await delay(pollIntervalMs, signal);
  }

  throw new Error("RunningHub 生成超时");
}

async function postJson({ fetchImpl, url, apiKey, body, signal }) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`RunningHub 请求失败：${response.status} ${payload.errorMessage || text.slice(0, 300)}`);
  }
  return payload;
}

function summarizeModelViews(transcript = []) {
  const latest = new Map();
  for (const item of transcript || []) {
    if (item.role !== "participant") continue;
    latest.set(item.agentName || item.agentId, compactPosterText(item.content, 26));
  }
  return [...latest.entries()].slice(0, 3).map(([name, content]) => `${name}：${content}`).join("；");
}

function compactPosterText(text, maxLength) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\*\*/g, "")
    .replace(/[。！？；，、,.!?;:：]+$/g, "")
    .trim();
  if (clean.length <= maxLength) return clean;

  const slice = clean.slice(0, maxLength);
  const boundary = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("！"),
    slice.lastIndexOf("？"),
    slice.lastIndexOf("；"),
    slice.lastIndexOf("，"),
    slice.lastIndexOf("、"),
    slice.lastIndexOf(" ")
  );
  const safe = boundary > Math.floor(maxLength * 0.55) ? slice.slice(0, boundary) : slice;
  return safe.replace(/[。！？；，、,.!?;:：]+$/g, "").trim();
}

function normalizeHostWording(text) {
  return String(text || "")
    .replace(/主持人(倾向|观点|认为)/g, "综合判断")
    .replace(/我的观点/g, "综合判断");
}

function contentTypeFor(outputType = "png") {
  const type = String(outputType || "png").toLowerCase();
  if (type.includes("jpg") || type.includes("jpeg")) return "image/jpeg";
  if (type.includes("webp")) return "image/webp";
  return "image/png";
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("RunningHub request aborted"));
      }, { once: true });
    }
  });
}
