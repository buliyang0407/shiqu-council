const defaultModelIds = [
  "mimo-v2.5-pro",
  "aihubmix-gpt-5.5",
  "aihubmix-claude-sonnet-4-6-think",
  "aihubmix-gemini-3.1-pro-preview",
  "aihubmix-grok-4",
  "mimo-v2.5",
  "mimo-v2-pro"
];

const moderatorClientId = "aihubmix-claude-sonnet-4-6-think";

const moderatorPersona = [
  "你是“石渠”的掌议人，像一位冷静的案牍官和谋臣首席。",
  "你的气质是克制、清醒、会裁剪，不炫技，不煽情，不抢谋士的戏。",
  "你一直记得目标：让多个模型的议事帮用户看清问题、压实取舍、形成可执行判断。",
  "表达可以有自己的气息，但不要端着；短句、有力度、少废话。"
].join("\n");

const voiceProfiles = [
  { maxChars: 96, prompt: "你反应快，说话短促，像随手抛一个有用点子。控制在 50 到 80 字。" },
  { maxChars: 136, prompt: "你会多补半句原因，但别写长。控制在 80 到 110 字。" },
  { maxChars: 86, prompt: "你说话直接，喜欢砍掉废话。控制在 40 到 70 字。" },
  { maxChars: 126, prompt: "你像聊天一样，有一点生活感。控制在 70 到 100 字。" },
  { maxChars: 112, prompt: "你习惯泼一点冷水，指出一个被忽略的坑。控制在 60 到 90 字。" },
  { maxChars: 104, prompt: "你偏行动派，总想给出下一步。控制在 60 到 90 字。" },
  { maxChars: 88, prompt: "你会抛一个稍微野一点的角度，但不能跑题。控制在 50 到 75 字。" },
  { maxChars: 140, prompt: "你说话稳一点，会照顾现实成本。控制在 80 到 115 字。" }
];

export const personaPresets = [
  { id: "strategist", name: "军师", icon: "谋", prompt: "像一位主公身边的军师，先抓胜负手和资源约束，再给取舍。语气沉稳，善于把复杂局面压成一两个关键判断。" },
  { id: "chief-of-staff", name: "长史", icon: "吏", prompt: "像负责统筹政务的长史，重视流程、责任边界、执行顺序和后续成本。少讲愿景，多讲怎么落地。" },
  { id: "devils-advocate", name: "逆耳谋士", icon: "逆", prompt: "专门说不中听但有用的话，指出方案里最容易被忽略的代价、风险和自欺之处；不抬杠，只拆危险假设。" },
  { id: "arbiter", name: "裁断官", icon: "断", prompt: "像审案的裁断官，重视证据、定义和判断口径。遇到含混问题，会先逼大家把标准说清楚。" },
  { id: "scout", name: "斥候", icon: "察", prompt: "像前线斥候，专门补充现实现场、边缘变量、早期信号和可能的突发变化。表达具体，少抽象。" },
  { id: "risk-officer", name: "风控官", icon: "险", prompt: "像风控官一样思考，先找最坏情形、不可逆损失、退出机制和止损线。语气冷静，不制造恐慌。" },
  { id: "product-lead", name: "产品官", icon: "品", prompt: "像产品负责人，关注用户体验、真实需求、最小可行方案和反馈闭环。喜欢把大想法压成小实验。" },
  { id: "operations-lead", name: "运营官", icon: "营", prompt: "像运营负责人，关注资源、人力、时间表、协同成本和持续维护。会判断一件事能不能长期跑起来。" },
  { id: "ethicist", name: "伦理顾问", icon: "义", prompt: "从人的尊严、公平、责任和长期信任出发，但不空谈道德，会把价值判断落到具体选择上。" },
  { id: "data-analyst", name: "数策师", icon: "数", prompt: "像数据分析师，习惯问样本、基准、概率和指标。没有数据时会明确指出不确定性，并给出可验证口径。" },
  { id: "historian", name: "史官", icon: "史", prompt: "从历史类比和制度惯性看问题，不卖弄典故，只用历史帮助识别重复出现的人性和组织规律。" },
  { id: "detective", name: "侦探", icon: "探", prompt: "像侦探一样从线索、动机、矛盾和缺失信息入手，善于发现表面问题背后的真正问题。" },
  { id: "jobs", name: "乔布斯", icon: "J", prompt: "模仿乔布斯的人设，关注科技、创新、产品直觉和取舍，说话简洁、有压迫感，不空泛。" },
  { id: "luxun", name: "鲁迅", icon: "鲁", prompt: "扮演鲁迅，文风犀利冷静、一针见血，说话带含蓄讽刺，语气沉稳严肃，用词有民国文风，不浮夸，讲道理带批判性，全程保持人设不跳戏，言语简洁。" },
  { id: "skeptic", name: "怀疑者", icon: "疑", prompt: "保持怀疑精神，专门检查隐含前提、偷换概念和过度乐观，但不要为了反对而反对。" },
  { id: "parent", name: "家长视角", icon: "家", prompt: "从普通家长和家庭生活的真实成本出发，重视孩子状态、家长精力、时间预算和情绪消耗。" },
  { id: "doctor", name: "医生视角", icon: "医", prompt: "像谨慎的临床医生一样思考，重视风险边界、个体差异和长期影响，但不要制造焦虑。" },
  { id: "operator", name: "执行派", icon: "行", prompt: "偏务实，喜欢把抽象判断压成可以执行的选择、步骤和边界。" },
  { id: "philosopher", name: "哲学家", icon: "思", prompt: "关注概念、价值冲突和问题定义，帮助大家看清真正争论的是什么。" },
  { id: "economist", name: "经济学家", icon: "济", prompt: "从机会成本、激励、边际收益和风险收益比来看问题，表达清楚但不堆术语。" },
  { id: "designer", name: "设计师", icon: "设", prompt: "关注体验、情绪、场景和人的真实使用方式，能把问题讲得具体可感。" },
  { id: "elder", name: "长者", icon: "稳", prompt: "语气稳、见过世面，重视长期后果、家庭关系和朴素常识，不急着下判断。" }
];

export function createDefaultAgents(modelCatalog = []) {
  const availableIds = modelCatalog.filter((model) => model.available).map((model) => model.id);
  const ids = defaultModelIds.filter((id) => availableIds.includes(id));
  const fallbackIds = ids.length ? ids : defaultModelIds;

  return [0, 1, 2].map((index) => buildAgent({
    index,
    clientId: fallbackIds[index % fallbackIds.length],
    modelCatalog
  }));
}

export function normalizeAgents(rawAgents = [], modelCatalog = [], count = 3) {
  const safeCount = clamp(Number(count || rawAgents.length || 3), 2, 8);
  const defaults = createDefaultAgents(modelCatalog);
  const result = [];

  for (let index = 0; index < safeCount; index += 1) {
    const raw = rawAgents[index] || {};
    const fallback = defaults[index % defaults.length];
    result.push(buildAgent({
      index,
      clientId: raw.clientId || fallback.clientId,
      persona: raw.persona || "",
      presetId: raw.presetId || "",
      voiceIndex: Number.isFinite(Number(raw.voiceIndex)) ? Number(raw.voiceIndex) : index,
      maxChars: raw.maxChars,
      modelCatalog
    }));
  }

  return result;
}

export async function runDiscussion({
  topic,
  rounds = 1,
  agents,
  moderatorStartRound = 1,
  provider,
  signal,
  onEvent = () => {}
}) {
  const normalizedTopic = String(topic || "").trim();
  if (!normalizedTopic) throw new Error("topic is required");
  if (typeof provider !== "function") throw new Error("provider is required");

  const speakers = agents?.length ? agents : createDefaultAgents();
  const transcript = [];
  const emit = (event) => {
    const enriched = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...event };
    onEvent(enriched);
    return enriched;
  };

  emit({ type: "status", content: "讨论开始" });
  const opening = await makeModeratorOpening({ provider, topic: normalizedTopic, signal, emit });
  transcript.push(opening);

  for (let round = 1; round <= rounds; round += 1) {
    throwIfAborted(signal);

    for (const agent of speakers) {
      throwIfAborted(signal);
      const message = await runParticipantStep({
        emit,
        provider,
        topic: normalizedTopic,
        agent,
        round,
        transcript: [...transcript],
        signal
      });
      if (message) transcript.push(message);
    }

    if (round < rounds && round >= moderatorStartRound) {
      const guidance = await getModeratorGuidance({ provider, topic: normalizedTopic, round, transcript, signal });
      if (guidance.directive) {
        const message = emitModeratorGuidance({ emit, round, guidance });
        transcript.push(message);
      }
    }
  }

  transcript.push(...await collectModelVotes({ provider, topic: normalizedTopic, agents: speakers, transcript, signal, emit }));
  const finalMessage = await makeFinalMessage({ provider, topic: normalizedTopic, transcript, signal, emit });
  transcript.push(finalMessage);
  transcript.push(...await emitModelSupplements({ provider, topic: normalizedTopic, agents: speakers, transcript, signal, emit }));
  emit({ type: "status", content: "讨论结束" });
  return transcript;
}

export async function runSingleTurn({
  topic,
  agent,
  transcript,
  userInput,
  provider,
  signal,
  onEvent = () => {}
}) {
  const normalizedTopic = String(topic || "").trim();
  const userNote = String(userInput || "").trim();
  if (!normalizedTopic) throw new Error("topic is required");
  if (!agent) throw new Error("agent is required");
  if (!userNote) throw new Error("user input is required");

  const emit = (event) => {
    const enriched = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...event };
    onEvent(enriched);
    return enriched;
  };

  const augmentedTranscript = [
    ...(transcript || []),
    {
      role: "user",
      agentName: "我",
      content: `用户插话：${userNote}`
    }
  ];
  emitThinking({ emit, agent, round: inferNextRound(transcript), role: "participant" });
  const result = await callProviderTimed(provider, {
    topic: normalizedTopic,
    agent,
    round: inferNextRound(transcript),
    transcript: augmentedTranscript,
    mode: "participant",
    userInput: userNote,
    signal
  });

  return emitMessage({ emit, agent, round: inferNextRound(transcript), content: result.content, role: "participant", durationMs: result.durationMs });
}

export async function continueDiscussion({
  topic,
  agents,
  transcript = [],
  rounds = 1,
  startIndex = 0,
  provider,
  signal,
  onEvent = () => {}
}) {
  const normalizedTopic = String(topic || "").trim();
  if (!normalizedTopic) throw new Error("topic is required");
  if (typeof provider !== "function") throw new Error("provider is required");

  const speakers = agents?.length ? agents : createDefaultAgents();
  const state = stripConclusionTail(transcript);
  const emit = (event) => {
    const enriched = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...event };
    onEvent(enriched);
    return enriched;
  };
  const safeRounds = clamp(Number(rounds || 1), 1, 2);
  let cursor = clamp(Number(startIndex || 0), 0, speakers.length - 1);

  emit({ type: "status", content: "继续讨论" });

  for (let localRound = 1; localRound <= safeRounds; localRound += 1) {
    throwIfAborted(signal);
    const round = inferNextRound(state);

    const orderedSpeakers = rotateAgents(speakers, cursor);
    for (const agent of orderedSpeakers) {
      throwIfAborted(signal);
      const message = await runParticipantStep({
        emit,
        provider,
        topic: normalizedTopic,
        agent,
        round,
        transcript: [...state],
        signal
      });
      if (message) state.push(message);
    }
    cursor = 0;

    if (localRound < safeRounds) {
      const guidance = await getModeratorGuidance({ provider, topic: normalizedTopic, round, transcript: state, signal });
      if (guidance.directive) {
        const message = emitModeratorGuidance({ emit, round, guidance });
        state.push(message);
      }
    }
  }

  state.push(...await collectModelVotes({ provider, topic: normalizedTopic, agents: speakers, transcript: state, signal, emit }));
  const finalMessage = await makeFinalMessage({ provider, topic: normalizedTopic, transcript: state, signal, emit });
  state.push(finalMessage);
  state.push(...await emitModelSupplements({ provider, topic: normalizedTopic, agents: speakers, transcript: state, signal, emit }));
  emit({ type: "status", content: "讨论结束" });
  return state;
}

export async function runConclusion({ topic, transcript, agents = [], provider, signal, onEvent = () => {} }) {
  const normalizedTopic = String(topic || "").trim();
  if (!normalizedTopic) throw new Error("topic is required");
  const emit = (event) => {
    const enriched = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...event };
    onEvent(enriched);
    return enriched;
  };
  const state = stripConclusionTail(transcript);
  const finalMessage = await makeFinalMessage({ provider, topic: normalizedTopic, transcript: state, signal, emit });
  await emitModelSupplements({
    provider,
    topic: normalizedTopic,
    agents,
    transcript: [...state, finalMessage],
    signal,
    emit
  });
  return finalMessage;
}

export function parseModeratorDecision(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) return silentDecision();

  try {
    const parsed = JSON.parse(match[0]);
    return {
      shouldIntervene: Boolean(parsed.shouldIntervene),
      killSwitch: Boolean(parsed.killSwitch),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      directive: typeof parsed.directive === "string" ? parsed.directive : ""
    };
  } catch {
    return silentDecision();
  }
}

export function createMockProvider() {
  return async ({ topic, agent, mode, userInput }) => {
    await delay(120);

    if (mode === "moderator") {
      return JSON.stringify({
        shouldIntervene: false,
        killSwitch: false,
        reason: "",
        directive: ""
      });
    }

    if (mode === "opening") {
      return `先把题目放到桌面上：${topic}。别急着站队，先看真正冲突在哪里、代价落在谁身上，最后再把选择压成一句能行动的话。`;
    }

    if (mode === "final") {
      return `## 定案\n先做低成本版本，别把好奇心搞成任务。理由是后悔空间大，但精力消耗也要被管住。\n\n## 理由\n- 成本低，试错不会伤筋动骨。\n- 先设退出线，避免越聊越像任务。\n\n## 谋士分布\n2/3 模型支持轻量尝试，1/3 模型主张谨慎推进。\n\n| 票向 | 模型 | 数量 |\n| --- | --- | --- |\n| 轻量尝试 | 甲、丙 | 2 |\n| 谨慎推进 | 乙 | 1 |\n\n## 各家短评\n- **甲**：轻量尝试；后悔空间大。\n- **乙**：谨慎推进；别消耗自己。\n\n## 下一步\n- 先试一次小版本。\n- 累了就停。`;
    }

    if (mode === "supplement") {
      return `我补一句：按掌议人的定案走可以，但要先设好退出条件。`;
    }

    if (userInput) {
      return `你这句挺关键，别聊玄了。我的感觉是：先把最折腾人的部分删掉，留一个低成本版本试试。很多事不是不能做，是别一上来就搞成任务。`;
    }

    return `我先瞎说一句：这事别先问“对不对”，先问“值不值”。如果成本低、后悔空间大，就可以试；如果一搞就很累，那多半不是好主意。`;
  };
}

export function createOpenAICompatibleProvider({
  apiKey,
  baseUrl = "https://api.openai.com/v1",
  model = "gpt-4o-mini",
  label = "",
  clientCatalog = null,
  clients = null,
  fetchImpl = fetch
}) {
  const defaultClient = { apiKey, baseUrl, model, label };
  const clientMap = clientCatalog || clients || { default: defaultClient };
  const hasAnyKey = Object.values(clientMap).some((client) => client?.apiKey) || apiKey;
  if (!hasAnyKey) return createMockProvider();

  return async ({ topic, agent, round, transcript, mode, userInput, signal }) => {
    const client = resolveClient({ clientMap, defaultClient, agent, mode });
    if (!client?.apiKey) {
      throw new Error(`模型未配置 API Key，已停止假回答：${agent?.name || agent?.clientId || "unknown"}`);
    }

    const messages =
      mode === "moderator"
        ? buildModeratorMessages({ topic, round, transcript })
        : mode === "opening"
          ? buildModeratorOpeningMessages({ topic })
          : mode === "final"
            ? buildFinalMessages({ topic, transcript })
            : mode === "vote"
              ? buildVoteMessages({ topic, agent, transcript })
              : mode === "supplement"
                ? buildSupplementMessages({ topic, agent, transcript })
                : buildParticipantMessages({ topic, agent, round, transcript, userInput });

    const body = buildCompletionBody({
      client,
      model,
      messages: withClientSystemPrefix(messages, client),
      mode,
      agent
    });
    let payload = await requestChatCompletion({ fetchImpl, client, baseUrl, body, signal });
    let content = extractVisibleContent(payload);
    let retryReason = isTruncatedResponse(payload) ? "truncated" : !content ? "empty" : "";

    if (retryReason) {
      const retryMessages = [
        ...messages,
        content ? { role: "assistant", content } : null,
        {
          role: "user",
          content: retryReason === "truncated"
            ? "上一轮可展示正文被截断。请重新输出一段完整正文，第一句观点先行，结尾必须完整；不要输出思考过程、模型名或解释。"
            : "上一轮没有返回可展示正文。请只输出最终可展示发言正文，不要输出思考过程、模型名或解释。"
        }
      ].filter(Boolean);
      payload = await requestChatCompletion({
        fetchImpl,
        client,
        baseUrl,
        body: buildCompletionBody({
          client,
          model,
          messages: withClientSystemPrefix(retryMessages, client),
          mode,
          agent,
          retry: true,
          retryReason
        }),
        signal
      });
      content = extractVisibleContent(payload);
    }

    if (!content) {
      throw new Error(`模型没有返回可展示正文：${client.label || client.model || agent?.name || "unknown"}${describeEmptyResponse(payload)}`);
    }
    return content;
  };
}

function buildCompletionBody({ client, model, messages, mode, agent, retry = false, retryReason = "" }) {
  const body = {
    model: client.model || model,
    messages,
    temperature: ["moderator", "opening", "final"].includes(mode) ? 0.35 : 0.72
  };
  body[client.tokenParam || "max_tokens"] = completionTokenLimit({ client, mode, agent, retry, retryReason });

  if (client.webSearch) {
    body.tools = [
      {
        type: "web_search",
        max_keyword: Number(client.webSearchMaxKeyword || 2),
        force_search: Boolean(client.forceSearch),
        limit: Number(client.webSearchLimit || 2),
        user_location: {
          type: "approximate",
          country: "China",
          region: "Zhejiang",
          city: "Hangzhou"
        }
      }
    ];
    body.tool_choice = "auto";
    body.thinking = { type: "disabled" };
  } else if (client.thinking) {
    body.thinking = { type: "enabled" };
  }
  if (client.reasoningEffort) body.reasoning_effort = client.reasoningEffort;
  return body;
}

function completionTokenLimit({ client, mode, agent, retry, retryReason = "" }) {
  const expanded = client.expandedOutput || client.tokenParam === "max_completion_tokens";
  const normalLimits = { participant: 220, opening: 180, moderator: 180, vote: 120, final: 900, supplement: 120 };
  const expandedLimits = { participant: 2200, opening: 520, moderator: 720, vote: 360, final: 3600, supplement: 520 };
  let base = (expanded ? expandedLimits : normalLimits)[mode] || normalLimits.participant;
  if (mode === "participant" && agent?.speechLimit) {
    const dynamicLimit = Math.ceil(Number(agent.speechLimit) * 1.8) + 120;
    base = Math.min(Math.max(base, dynamicLimit), expanded ? 3600 : 1600);
  }
  if (!retry) return base;
  return Math.ceil(base * (retryReason === "truncated" ? 2.2 : 1.5));
}

async function requestChatCompletion({ fetchImpl, client, baseUrl, body, signal }) {
  const timeoutMs = Number(client.timeoutMs) || (client.expandedOutput ? 120_000 : 45_000);
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error("model request timeout")), timeoutMs);
  const relayAbort = () => timeoutController.abort(signal.reason);
  if (signal?.aborted) relayAbort();
  else signal?.addEventListener("abort", relayAbort, { once: true });

  let response;
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (client.authHeader === "api-key") {
      headers["api-key"] = client.apiKey;
    } else {
      headers.Authorization = `Bearer ${client.apiKey}`;
    }

    response = await fetchImpl(`${String(client.baseUrl || baseUrl).replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: timeoutController.signal
    });
  } catch (error) {
    if (!signal?.aborted && timeoutController.signal.aborted) {
      throw new Error(`模型请求超时：${client.label || client.model || "unknown"}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", relayAbort);
  }

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(userFriendlyModelError({ status: response.status, bodyText, client }));
  }

  return response.json();
}

function userFriendlyModelError({ status, bodyText, client }) {
  const body = String(bodyText || "");
  const lower = body.toLowerCase();
  const label = client?.label || client?.model || "模型";

  if (lower.includes("quota exhausted") || lower.includes("insufficient_quota") || lower.includes("balance")) {
    const provider = client?.provider || label;
    return `${provider} 额度耗尽：请充值或切换到其他可用模型后继续。`;
  }

  if (status === 401 || status === 403) {
    return `${label} 鉴权失败：请检查 API Key、账户状态或模型权限。`;
  }

  if (status === 429) {
    return `${label} 请求过于频繁：稍等一下再继续。`;
  }

  return `模型接口返回异常：${status} ${body.slice(0, 220)}`;
}

function withClientSystemPrefix(messages, client) {
  const prefix = String(client?.systemPrefix || "").trim();
  if (!prefix) return messages;
  return [
    { role: "system", content: prefix },
    ...messages
  ];
}

function extractVisibleContent(payload) {
  const choice = payload?.choices?.[0] || {};
  const message = choice.message || {};
  const candidates = [
    message.content,
    message.text,
    message.output_text,
    choice.text,
    choice.delta?.content,
    payload?.output_text,
    payload?.content
  ];

  for (const candidate of candidates) {
    const content = normalizeContentCandidate(candidate);
    if (content) return content;
  }
  return "";
}

function isTruncatedResponse(payload) {
  const reason = String(payload?.choices?.[0]?.finish_reason || payload?.choices?.[0]?.finishReason || "").toLowerCase();
  return ["length", "max_tokens", "max_output_tokens"].some((item) => reason.includes(item));
}

function normalizeContentCandidate(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(normalizeContentCandidate).filter(Boolean).join("").trim();
  }
  if (value && typeof value === "object") {
    return normalizeContentCandidate(
      value.text ??
      value.content ??
      value.output_text ??
      value.value
    );
  }
  return "";
}

function describeEmptyResponse(payload) {
  const choice = payload?.choices?.[0] || {};
  const message = choice.message || {};
  const finishReason = choice.finish_reason || choice.finishReason;
  const messageKeys = Object.keys(message).filter((key) => key !== "reasoning_content").join(", ");
  const details = [
    finishReason ? `finish_reason=${finishReason}` : "",
    messageKeys ? `message_keys=${messageKeys}` : ""
  ].filter(Boolean).join("; ");
  return details ? `（${details}）` : "";
}

export function buildParticipantMessages({ topic, agent, round, transcript, userInput = "" }) {
  const personaText = agent.persona
    ? `你还要保持这个人设或风格：${agent.persona}`
    : "你没有特殊人设，保持自然、清醒、口语化。";
  const speechLimitText = agent.speechLimit
    ? [
        `这次你的单次发言上限是 ${agent.speechLimit} 个汉字。`,
        "这是上限，不是目标；能短就短，复杂时可以展开说清楚。",
        agent.speechLimit >= 260 ? "可以分成 1 到 3 个自然段，但不要写标题、列表或 Markdown。" : "只写一个自然段，不要换行。"
      ].join("")
    : (agent.voicePrompt || "每次发言 50 到 100 个汉字，最多 120 个汉字。只写一个自然段，不要换行。");
  const userInstruction = userInput
    ? `用户刚刚插话：${userInput}。你必须把这句话当作新的重要约束，重新思考后再发言。`
    : "";

  return [
    {
      role: "system",
      content: [
        "你是“石渠”里的谋士，不是辩手、客服、讲稿作者或陪聊。",
        "用户像主公一样把问题交给你们，你的任务是帮他看清取舍、风险、优先级和下一步动作。",
        "你的发言要像在献策：先判断，再解释，再给边界或动作；不要像普通 AI 助手泛泛回答。",
        speechLimitText,
        "每次发言必须观点先行：第一句先亮出本轮判断或新发现，不超过 24 个汉字。",
        "说人话优先：像给聪明但不在这个行业里的人解释，不要像投研报告、论文摘要或咨询黑话。",
        "每次最多使用一个专业词；用了专业词，必须马上用括号或下一小句翻译成白话。",
        "不要连续堆抽象名词，例如“基础设施、闭环、生态、定价权、壁垒、范式、代理权、合规担保、调用溢价”。如果必须用，立刻说明“说白了就是……”。",
        "每次发言至少要有一个具体例子、生活类比或落地动作，让用户知道这句话和自己有什么关系。",
        "可以有深度，但深度要藏在清楚里面；宁可少讲一个概念，也不要让用户读完只觉得厉害但不懂。",
        "每次发言都要提供增量：新角度、新边界、新风险、新反例、新行动建议，至少占一样。",
        "如果前面已经讲过同类理由，你必须换一个切入点，或者把它压成更能决策的条件。",
        "不要为了反对而反对；如果同意前文，也要说明同意的边界或补一个更实用的条件。",
        "你可以改变立场，但必须自然说明为什么改变。",
        "不知道事实时直接承认；涉及时效信息、政策、价格、新闻、医学、法律、软件版本时，提醒需要核查。",
        "发言前先看已有讨论：少重复别人已经讲清楚的点；如果你改变了想法，可以自然说出转变原因。",
        "如果分歧还在，请把分歧压成可决策的条件，例如“如果看重 A 就选 X，如果看重 B 就选 Y”。",
        "不要说“我继续这个话题”“接着某某的话”“我方”“综上”等假腔调。",
        "少用抽象词，少讲大道理。最好有一句具体判断，或者一个很短的例子。",
        "结尾最好落到一句主公能用的话：该看什么信号、别踩什么坑、下一步怎么做。",
        "不要空泛地说“既要又要”“因人而异”“综合考虑”，除非后面给出明确优先级和动作。",
        "不要输出列表、标题、Markdown、编号。表达要像真人谋士，清楚、具体、不端着。",
        personaText
      ].filter(Boolean).join("\n")
    },
    {
      role: "user",
      content: [
        `话题：${topic}`,
        `内部序号：${round}`,
        `你的名字：${agent.name}`,
        `模型身份：${agent.title}`,
        userInstruction,
        "你已经看过前面所有发言。现在请用谋士献策的方式，给出本轮最有增量的一段。",
        "已有讨论：",
        formatTranscript(transcript),
        "只输出你的发言正文。"
      ].filter(Boolean).join("\n")
    }
  ];
}

export function buildModeratorMessages({ topic, round, transcript }) {
  return [
    {
      role: "system",
      content: [
        moderatorPersona,
        "你是这个议事房间的掌议人，只在完整一轮谋士发言结束后短暂引导下一轮。",
        "不要总结，不要下结论，不要重复参与者原话。",
        "你的任务是指出下一轮最该收窄的一个问题，让谋士别散。",
        "如果上一轮已经很清楚，也可以要求下一轮直接落到行动。",
        "只输出 JSON。",
        '格式：{"directive":"下一轮请把焦点压到……"}',
        "directive 控制在 24 到 55 个汉字。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `话题：${topic}`,
        `刚完成内部第 ${round} 轮。`,
        "已有讨论：",
        formatTranscript(transcript),
        "给下一轮一句短引导。"
      ].join("\n")
    }
  ];
}

export function buildModeratorOpeningMessages({ topic }) {
  return [
    {
      role: "system",
      content: [
        moderatorPersona,
        "现在由你开场引出话题。",
        "不要用固定格式，不要写标题，不要列条目。",
        "自然说一小段，像把一桩案子放到桌面中央。",
        "要点：复述论题、指出最可能的核心冲突、提醒各位谋士目标是帮助用户决策。",
        "控制在 55 到 95 个汉字。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `话题：${topic}`,
        "请直接输出掌议人的开场白。"
      ].join("\n")
    }
  ];
}

export function buildFinalMessages({ topic, transcript }) {
  const participantNames = uniqueParticipants(transcript);
  const participantCount = participantNames.length;
  const votes = voteRecords(transcript);

  return [
    {
      role: "system",
      content: [
        moderatorPersona,
        "你是这个议事房间的掌议人，负责做最终裁剪和统计总结，不是再发表一个参与者观点。",
        "输出要像一张紧凑的定案札记，第一眼先看到结论；不要像论文、不要像会议纪要。",
        "先讲人话，再讲术语。任何普通用户看第一遍都应该懂大意。",
        "禁止堆黑话和抽象名词。不要连续使用“基础设施、闭环、生态、定价权、壁垒、范式、代理权、合规担保、调用溢价”等词；若必须保留一个，马上用白话解释。",
        "计票必须只使用“模型投票记录”，不能凭完整会话重新猜票。",
        "每个模型只能算 1 票；票面表的模型数相加必须等于唯一参与者总数。",
        "如果所有模型同向，就写全体一致；如果有分歧，就写各票向人数和模型名。",
        "第一部分必须直接说清楚：最终建议是什么、为什么、今天先做哪一步。",
        "不要写空话，例如“需要平衡”“因人而异”“持续观察”；除非后面跟一个明确动作。",
        "不要写“掌议人观点”“主持人观点”“我认为”。掌议人的角色是概括、裁剪和提炼，不是多一个参与者。",
        "输出结构固定为：",
        "## 定案",
        "2 到 3 句。第一句直接给最终建议，不要铺垫；第二句必须用“说白了”把结论翻译成日常话。",
        "## 理由",
        "最多 3 条，每条短句，每条只讲一个理由，并尽量带例子或具体信号。",
        "## 谋士分布",
        "一句话统计 x/y 模型支持什么；有分歧时列紧凑表格：票向、模型、数量。",
        "## 各家短评",
        "逐行写每个模型，格式是“- **模型短名**：票向；一句理由”。",
        "## 下一步",
        "1 到 3 条今天或本周能做的动作。",
        "如果本题涉及时效事实，最后加一句“需核查：……”。",
        "总字数 260 到 420 个汉字。少用 emoji，不要花哨标题，不要代码块。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `话题：${topic}`,
        `唯一参与者总数：${participantCount}`,
        `参与者名单：${participantNames.join("、") || "暂无"}`,
        `模型投票记录：${votes || "暂无，请基于每个模型最后一次明确发言谨慎归纳，但必须说明口径。"}`,
        "完整会话：",
        formatTranscript(transcript),
        "请直接给出最终定案总结。把结论和建议放在最前面，模型细节放在最后。"
      ].join("\n")
    }
  ];
}

export function buildVoteMessages({ topic, agent, transcript }) {
  return [
    {
      role: "system",
      content: [
        "你是参与议事的谋士，现在要给掌议人一张私下投票单。",
        "只能根据你自己的最终判断投票，不要替别人投。",
        "票向必须是一个短立场标签，2 到 10 个汉字，例如“先降负荷”“继续观望”“可以尝试”。",
        "理由不超过 24 个汉字，动作不超过 24 个汉字。",
        "只输出 JSON，不要 Markdown。",
        '格式：{"stance":"短票向","reason":"一句理由","action":"一句动作"}'
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `话题：${topic}`,
        `你的名字：${agent.name}`,
        "完整讨论：",
        formatTranscript(transcript),
        "请给出你的最终投票。"
      ].join("\n")
    }
  ];
}

export function buildSupplementMessages({ topic, agent, transcript }) {
  const finalText = [...(transcript || [])].reverse().find((item) => item.role === "final")?.content || "";
  return [
    {
      role: "system",
      content: [
        "你刚看完掌议人的统一结论，现在只补一句话。",
        "你可以同意，也可以补一个关键限制或遗漏，但不能重新展开辩论。",
        "必须简洁、具体、口语化，20 到 45 个汉字。",
        "不要标题、列表、Markdown、编号。不要说“作为某模型”。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `话题：${topic}`,
        `你的名字：${agent.name}`,
        `掌议人定案：${finalText}`,
        "完整讨论：",
        formatTranscript(transcript),
        "只输出一句补充。"
      ].join("\n")
    }
  ];
}

export function formatTranscript(transcript) {
  if (!transcript?.length) return "暂无。";
  return transcript
    .map((item) => `${item.agentName || item.role}：${item.content}`)
    .join("\n\n");
}

function buildAgent({ index, clientId, persona = "", presetId = "", voiceIndex = index, maxChars, modelCatalog = [] }) {
  const model = modelCatalog.find((item) => item.id === clientId) || modelCatalog[0] || {};
  const preset = personaPresets.find((item) => item.id === presetId);
  const voice = voiceProfiles[Math.abs(voiceIndex) % voiceProfiles.length];
  const mergedPersona = [preset?.prompt, persona].filter(Boolean).join("\n");
  const displayName = model.label || `AI ${index + 1}`;
  const speechLimit = normalizeSpeechLimit(maxChars);
  return {
    id: `agent-${index + 1}`,
    name: displayName,
    title: preset?.name || "谋士",
    avatar: preset?.icon || avatarForModel(model, index),
    clientId: model.id || clientId || defaultModelIds[index % defaultModelIds.length],
    persona: mergedPersona,
    presetId,
    voiceIndex,
    voicePrompt: voice.prompt,
    speechLimit,
    maxChars: speechLimit || voice.maxChars
  };
}

function emitMessage({ emit, agent, round, content, role, durationMs }) {
  return emit({
    type: "message",
    role,
    agentId: agent.id,
    agentName: agent.name,
    agentTitle: agent.title,
    avatar: agent.avatar,
    round,
    durationMs,
    content: trimToReadableLimit(content, role === "participant" ? Math.max(agent.maxChars || 120, 180) : 2200)
  });
}

function normalizeSpeechLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return clamp(Math.round(number), 80, 800);
}

async function makeModeratorOpening({ provider, topic, signal, emit }) {
  emitThinking({
    emit,
    agent: { id: "moderator", name: "掌议人", title: "开题", avatar: "掌" },
    round: 0,
    role: "moderator"
  });

  try {
    const result = await callProviderTimed(provider, {
      topic,
      agent: { id: "moderator", name: "掌议人", title: "开题", avatar: "掌", clientId: moderatorClientId },
      round: 0,
      transcript: [],
      mode: "opening",
      signal
    });
    return emitModeratorOpening({ emit, topic, content: result.content, durationMs: result.durationMs });
  } catch (error) {
    throwIfAborted(signal);
    return emitModeratorOpening({ emit, topic, note: friendlyError(error) });
  }
}

function emitModeratorOpening({ emit, topic, content, durationMs, note }) {
  return emit({
    type: "message",
    role: "moderator",
    agentId: "moderator",
    agentName: "掌议人",
    agentTitle: "开题",
    avatar: "掌",
    round: 0,
    durationMs,
    note,
    content: trimToReadableLimit(
      content || `先把题目摆清楚：${topic}。各位谋士不用急着站队，重点是把核心冲突、现实代价和最后怎么选说透，目标是帮用户更好决策。`,
      180
    )
  });
}

function emitThinking({ emit, agent, round, role }) {
  emit({
    type: "thinking",
    role,
    agentId: agent.id,
    agentName: agent.name,
    agentTitle: agent.title,
    avatar: agent.avatar,
    round,
    content: `${agent.name} 正在思考`
  });
}

async function getModeratorDecision({ provider, topic, round, transcript, signal }) {
  const result = await callProviderTimed(provider, {
    topic,
    agent: { id: "moderator", name: "掌议人", title: "控场", avatar: "掌", clientId: moderatorClientId },
    round,
    transcript: [...transcript],
    mode: "moderator",
    signal
  });
  return { ...parseModeratorDecision(result.content), durationMs: result.durationMs };
}

async function getModeratorGuidance({ provider, topic, round, transcript, signal }) {
  const result = await callProviderTimed(provider, {
    topic,
    agent: { id: "moderator", name: "掌议人", title: "引导", avatar: "掌", clientId: moderatorClientId },
    round,
    transcript: [...transcript],
    mode: "moderator",
    signal
  });
  const parsed = parseModeratorGuidance(result.content);
  return { directive: trimToReadableLimit(parsed.directive, 80), durationMs: result.durationMs };
}

function emitModeratorGuidance({ emit, round, guidance }) {
  return emit({
    type: "message",
    role: "moderator",
    agentId: "moderator",
    agentName: "掌议人",
    agentTitle: "引导下一轮",
    avatar: "掌",
    round,
    durationMs: guidance.durationMs,
    content: cleanText(guidance.directive)
  });
}

async function runParticipantStep({ emit, provider, topic, agent, round, transcript, signal }) {
  emitThinking({ emit, agent, round, role: "participant" });
  try {
    const result = await callProviderTimed(provider, {
      topic,
      agent,
      round,
      transcript,
      mode: "participant",
      signal
    });
    return emitMessage({ emit, agent, round, content: result.content, role: "participant", durationMs: result.durationMs });
  } catch (error) {
    throwIfAborted(signal);
    emitModelSkip({ emit, agent, round, error });
    return null;
  }
}

async function collectModelVotes({ provider, topic, agents = [], transcript, signal, emit }) {
  if (!agents?.length) return [];

  const votes = [];
  for (const agent of agents) {
    throwIfAborted(signal);
    try {
      const result = await callProviderTimed(provider, {
        topic,
        agent,
        round: inferNextRound(transcript),
        transcript: [...transcript],
        mode: "vote",
        signal
      });
      const vote = normalizeVote(parseModelVote(result.content), agent);
      votes.push(emit({
        type: "vote",
        role: "vote",
        agentId: agent.id,
        agentName: agent.name,
        agentTitle: "投票",
        avatar: agent.avatar,
        round: inferNextRound(transcript),
        durationMs: result.durationMs,
        content: `${vote.stance}；${vote.reason}；${vote.action}`,
        stance: vote.stance,
        reason: vote.reason,
        action: vote.action
      }));
    } catch (error) {
      throwIfAborted(signal);
      const fallback = fallbackVoteFromTranscript(agent, transcript);
      votes.push(emit({
        type: "vote",
        role: "vote",
        agentId: agent.id,
        agentName: agent.name,
        agentTitle: "投票",
        avatar: agent.avatar,
        round: inferNextRound(transcript),
        content: `${fallback.stance}；${fallback.reason}；${fallback.action}`,
        stance: fallback.stance,
        reason: fallback.reason,
        action: fallback.action,
        note: friendlyError(error)
      }));
    }
  }
  return votes;
}

async function makeFinalMessage({ provider, topic, transcript, signal, emit }) {
  emitThinking({
    emit,
    agent: { id: "final", name: "掌议人", title: "定案", avatar: "掌" },
    round: inferNextRound(transcript),
    role: "final"
  });
  const result = await callProviderTimed(provider, {
    topic,
    agent: { id: "final", name: "掌议人", title: "定案", avatar: "掌", clientId: moderatorClientId },
    round: inferNextRound(transcript),
    transcript: [...(transcript || [])],
    mode: "final",
    signal
  });

  return emit({
    type: "final",
    role: "final",
    agentId: "final",
    agentName: "掌议人",
    agentTitle: "定案",
    avatar: "掌",
    durationMs: result.durationMs,
    content: trimToReadableLimit(result.content, 1800)
  });
}

async function emitModelSupplements({ provider, topic, agents = [], transcript, signal, emit }) {
  if (!agents?.length) return [];

  const messages = [];
  for (const agent of agents) {
    throwIfAborted(signal);
    emitThinking({ emit, agent: { ...agent, title: "一句补充" }, round: inferNextRound(transcript), role: "participant" });
    try {
      const result = await callProviderTimed(provider, {
        topic,
        agent,
        round: inferNextRound(transcript),
        transcript: [...transcript, ...messages],
        mode: "supplement",
        signal
      });
      const message = emit({
        type: "message",
        role: "participant",
        agentId: agent.id,
        agentName: agent.name,
        agentTitle: "一句补充",
        avatar: agent.avatar,
        round: inferNextRound(transcript),
        durationMs: result.durationMs,
        content: trimToReadableLimit(result.content, 90)
      });
      messages.push(message);
    } catch (error) {
      throwIfAborted(signal);
      emitModelSkip({ emit, agent, round: inferNextRound(transcript), error });
    }
  }
  return messages;
}

function emitModelSkip({ emit, agent, round, error }) {
  emit({
    type: "notice",
    role: "participant",
    agentId: agent.id,
    agentName: agent.name,
    agentTitle: "暂时跳过",
    avatar: agent.avatar,
    round,
    content: `${agent.name} 这轮没接上（${friendlyError(error)}），先让其他模型继续。`
  });
}

function friendlyError(error) {
  const message = String(error?.message || "请求失败");
  if (message.includes("额度耗尽")) return message;
  if (message.includes("quota exhausted")) return "模型额度耗尽";
  if (message.includes("鉴权失败")) return message;
  if (message.includes("超时") || message.includes("timeout")) return "请求超时";
  if (message.includes("没有返回可展示正文")) return "没有返回正文";
  if (message.includes("model request failed")) return "接口返回异常";
  return "请求失败";
}

async function callProviderTimed(provider, payload) {
  const startedAt = Date.now();
  const content = await provider(payload);
  return {
    content,
    durationMs: Date.now() - startedAt
  };
}

function resolveClient({ clientMap, defaultClient, agent, mode }) {
  const id = agent?.clientId || agent?.id;
  return clientMap[id] || clientMap[mode] || clientMap.default || defaultClient;
}

function inferNextRound(transcript = []) {
  const rounds = transcript.map((item) => Number(item.round || 0)).filter(Boolean);
  return rounds.length ? Math.max(...rounds) + 1 : 1;
}

function rotateAgents(agents, startIndex) {
  return [...agents.slice(startIndex), ...agents.slice(0, startIndex)];
}

function stripConclusionTail(transcript = []) {
  return (transcript || []).filter((item) => item.role !== "final" && item.role !== "vote" && item.agentTitle !== "一句补充");
}

function silentDecision() {
  return { shouldIntervene: false, killSwitch: false, reason: "", directive: "" };
}

function parseModeratorGuidance(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return { directive: typeof parsed.directive === "string" ? parsed.directive : "" };
    } catch {
      return { directive: "" };
    }
  }
  return { directive: cleanText(text) };
}

function parseModelVote(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return {
        stance: parsed.stance,
        reason: parsed.reason,
        action: parsed.action
      };
    } catch {
      // fall through to text parsing
    }
  }
  const parts = String(text || "").split(/[；;\n]/).map((item) => item.trim()).filter(Boolean);
  return {
    stance: parts[0],
    reason: parts[1],
    action: parts[2]
  };
}

function normalizeVote(vote, agent) {
  return {
    stance: trimToReadableLimit(vote?.stance || "综合判断", 16),
    reason: trimToReadableLimit(vote?.reason || latestParticipantText(agent, []), 32),
    action: trimToReadableLimit(vote?.action || "按结论执行一个小动作", 32)
  };
}

function fallbackVoteFromTranscript(agent, transcript = []) {
  const latest = latestParticipantText(agent, transcript);
  return {
    stance: "保留判断",
    reason: latest || "本轮未形成清晰票向",
    action: "以掌议人统计为准"
  };
}

function latestParticipantText(agent, transcript = []) {
  const latest = [...(transcript || [])].reverse().find((item) =>
    item.role === "participant" &&
    item.agentId === agent.id &&
    item.agentTitle !== "一句补充"
  );
  return trimToReadableLimit(latest?.content || "", 32);
}

function voteRecords(transcript = []) {
  return (transcript || [])
    .filter((item) => item.type === "vote" || item.role === "vote" || item.agentTitle === "投票")
    .map((item) => `${item.agentName}：票向=${item.stance || "未明"}；理由=${item.reason || ""}；动作=${item.action || ""}`)
    .join("\n");
}

function cleanText(text) {
  return String(text || "").trim();
}

function trimToReadableLimit(text, maxLength) {
  const clean = cleanText(text);
  if (clean.length <= maxLength) return clean;

  const window = clean.slice(0, maxLength);
  const punctuationIndex = Math.max(
    window.lastIndexOf("。"),
    window.lastIndexOf("！"),
    window.lastIndexOf("？"),
    window.lastIndexOf(";"),
    window.lastIndexOf("；")
  );
  if (punctuationIndex > 120) {
    return window.slice(0, punctuationIndex + 1);
  }
  return `${window.slice(0, maxLength - 1)}…`;
}

function avatarFor(index) {
  return ["一", "二", "三", "四", "五", "六", "七", "八"][index] || "AI";
}

function avatarForModel(model = {}, index = 0) {
  const label = `${model.label || ""} ${model.model || ""}`.toLowerCase();
  if (label.includes("gemini")) return "G";
  if (label.includes("gpt")) return "5";
  if (label.includes("deepseek")) return "深";
  if (label.includes("kimi")) return "K";
  if (label.includes("qwen")) return "千";
  if (label.includes("glm")) return "智";
  if (label.includes("minimax")) return "M";
  return avatarFor(index);
}

function uniqueParticipants(transcript = []) {
  const names = [];
  for (const item of transcript || []) {
    if (item.role !== "participant") continue;
    const name = item.agentName || item.agentId;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new Error("discussion aborted");
}
