import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFinalMessages,
  buildModeratorMessages,
  buildModeratorOpeningMessages,
  buildParticipantMessages,
  buildSupplementMessages,
  buildVoteMessages,
  continueDiscussion,
  createOpenAICompatibleProvider,
  createMockProvider,
  normalizeAgents,
  parseModeratorDecision,
  runDiscussion
} from "../server/discussion.mjs";

test("parseModeratorDecision extracts intervention fields from JSON text", () => {
  const decision = parseModeratorDecision(
    '前面不用管 {"shouldIntervene":true,"killSwitch":false,"reason":"讨论在重复","directive":"请收窄默认场景。"} 后面也不用管'
  );

  assert.equal(decision.shouldIntervene, true);
  assert.equal(decision.killSwitch, false);
  assert.equal(decision.reason, "讨论在重复");
  assert.equal(decision.directive, "请收窄默认场景。");
});

test("parseModeratorDecision falls back to silent decision for invalid text", () => {
  const decision = parseModeratorDecision("我觉得可以继续聊。");

  assert.deepEqual(decision, {
    shouldIntervene: false,
    killSwitch: false,
    reason: "",
    directive: ""
  });
});

test("runDiscussion calls participants in A, B, C order for each round", async () => {
  const events = [];
  const provider = async ({ agent, round }) => {
    if (agent.id === "moderator") {
      return '{"shouldIntervene":false,"killSwitch":false,"reason":"","directive":""}';
    }
    if (agent.id === "final") {
      return "共同结论：可以行动，但要带条件。";
    }
    return `${agent.id}-${round}`;
  };

  await runDiscussion({
    topic: "每天喝咖啡对人体有没有危害",
    rounds: 2,
    provider,
    onEvent: (event) => events.push(event)
  });

  const speakers = events
    .filter((event) => event.type === "message" && event.role === "participant" && event.agentTitle !== "一句补充")
    .map((event) => event.agentId);

  assert.deepEqual(speakers, ["agent-1", "agent-2", "agent-3", "agent-1", "agent-2", "agent-3"]);
});

test("prompt contract frames the room as adviser council", () => {
  const agent = normalizeAgents([{ clientId: "m", maxChars: 800 }], [{ id: "m", label: "GPT 5.5", provider: "AIHubMix", model: "gpt-5.5", available: true }], 1)[0];
  const participantSystem = buildParticipantMessages({
    topic: "五一节要不要带娃出游",
    agent,
    round: 1,
    transcript: []
  })[0].content;
  const openingSystem = buildModeratorOpeningMessages({ topic: "五一节要不要带娃出游" })[0].content;
  const guidanceSystem = buildModeratorMessages({ topic: "五一节要不要带娃出游", round: 1, transcript: [] })[0].content;
  const finalSystem = buildFinalMessages({ topic: "五一节要不要带娃出游", transcript: [] })[0].content;
  const supplementSystem = buildSupplementMessages({ topic: "五一节要不要带娃出游", agent, transcript: [] })[0].content;

  assert.match(participantSystem, /谋士/);
  assert.match(participantSystem, /观点先行/);
  assert.match(participantSystem, /提供增量/);
  assert.match(participantSystem, /改变立场/);
  assert.match(participantSystem, /涉及时效信息/);
  assert.match(participantSystem, /上限是 800 个汉字/);
  assert.match(participantSystem, /说人话优先/);
  assert.match(participantSystem, /说白了/);
  assert.match(openingSystem, /掌议人/);
  assert.match(openingSystem, /谋士目标是帮助用户决策/);
  assert.match(guidanceSystem, /掌议人/);
  assert.match(finalSystem, /## 定案/);
  assert.match(finalSystem, /## 理由/);
  assert.match(finalSystem, /## 谋士分布/);
  assert.match(finalSystem, /## 各家短评/);
  assert.match(finalSystem, /## 下一步/);
  assert.match(finalSystem, /先讲人话/);
  assert.match(finalSystem, /260 到 420/);
  assert.match(supplementSystem, /掌议人的统一结论/);
});

test("runDiscussion emits moderator opening and thinking states without visible round markers", async () => {
  const events = [];

  await runDiscussion({
    topic: "救猫还是救画",
    rounds: 1,
    provider: async ({ agent, mode }) => {
      if (mode === "opening") return "这题先别急着喊口号，真正要看的是生命、责任和不可替代性怎么落地。";
      return agent.id === "final" ? "最终救猫。" : "短发言";
    },
    onEvent: (event) => events.push(event)
  });

  const opening = events.find((event) => event.type === "message" && event.role === "moderator" && event.agentTitle === "开题");
  const thinking = events.filter((event) => event.type === "thinking");

  assert.match(opening.content, /真正要看/);
  assert.equal(thinking.some((event) => event.role === "moderator" && event.agentTitle === "开题"), true);
  assert.equal(thinking.filter((event) => event.role === "participant" && event.agentTitle !== "一句补充").length, 3);
  assert.equal(thinking.some((event) => event.role === "final"), true);
  assert.equal(events.some((event) => event.type === "round"), false);
});

test("runDiscussion skips a failed participant and keeps the room moving", async () => {
  const events = [];

  await runDiscussion({
    topic: "NAS 部署验证",
    rounds: 1,
    provider: async ({ agent }) => {
      if (agent.id === "agent-1") throw new Error("模型请求超时：Qwen");
      if (agent.id === "final") return "最终结论：继续推进。";
      return `${agent.name} 正常发言`;
    },
    onEvent: (event) => events.push(event)
  });

  const notice = events.find((event) => event.type === "notice");
  const messages = events.filter((event) =>
    event.type === "message" && event.role === "participant" && event.agentTitle !== "一句补充"
  );
  const final = events.find((event) => event.type === "final");

  assert.match(notice.content, /先让其他模型继续/);
  assert.equal(messages.length, 2);
  assert.ok(final);
});

test("runDiscussion lets the moderator guide only after a complete round", async () => {
  const events = [];

  await runDiscussion({
    topic: "五一节要不要带娃出游",
    rounds: 2,
    moderatorStartRound: 1,
    provider: async ({ agent, mode }) => {
      if (mode === "moderator") {
        return '{"directive":"下一轮请把预算和体力边界说清楚。"}';
      }
      if (mode === "final") {
        return "共同结论：五一可以出游，但避开热门远途景点。";
      }
      return `${agent.name} 发言`;
    },
    onEvent: (event) => events.push(event)
  });

  const participantCount = events.filter((event) => event.type === "message" && event.role === "participant" && event.agentTitle !== "一句补充").length;
  const moderator = events.find((event) => event.role === "moderator" && event.agentTitle === "引导下一轮");
  const final = events.find((event) => event.type === "final");

  assert.equal(participantCount, 6);
  assert.equal(moderator.content, "下一轮请把预算和体力边界说清楚。");
  assert.equal(final.content, "共同结论：五一可以出游，但避开热门远途景点。");
});

test("runDiscussion guides after the first full adviser pass by default", async () => {
  const events = [];

  await runDiscussion({
    topic: "要不要换工作",
    rounds: 2,
    provider: async ({ mode, agent }) => {
      if (mode === "moderator") return '{"directive":"下一轮请把机会成本压清楚。"}';
      if (mode === "final") return "最终先不裸辞。";
      if (mode === "vote") return `{"stance":"先不裸辞","reason":"${agent.name}看重风险","action":"先谈机会"}`;
      if (mode === "supplement") return "补一句，先留退路再行动。";
      return `${agent.name} 发言`;
    },
    onEvent: (event) => events.push(event)
  });

  const firstGuidanceIndex = events.findIndex((event) => event.role === "moderator" && event.agentTitle === "引导下一轮");
  const participantBeforeGuidance = events
    .slice(0, firstGuidanceIndex)
    .filter((event) => event.type === "message" && event.role === "participant" && event.agentTitle !== "一句补充");

  assert.equal(participantBeforeGuidance.length, 3);
  assert.equal(events.filter((event) => event.role === "moderator" && event.agentTitle === "引导下一轮").length, 1);
});

test("runDiscussion emits opening, guidance, votes, final, and supplements in order", async () => {
  const events = [];

  await runDiscussion({
    topic: "公众号选题要不要追热点",
    rounds: 3,
    provider: async ({ mode, agent }) => {
      if (mode === "moderator") return '{"directive":"下一轮请把流量和长期人设分开。"}';
      if (mode === "vote") return `{"stance":"谨慎追","reason":"${agent.name}重视长期","action":"先小稿测试"}`;
      if (mode === "final") return "## 定案\n谨慎追热点。\n\n## 理由\n- 不伤长期人设。\n\n## 谋士分布\n3/3 支持谨慎追。\n\n## 各家短评\n- **甲**：谨慎追；先小稿测试。\n\n## 下一步\n- 今天列三个备选。";
      if (mode === "supplement") return "可以，但别让热点牵着账号走。";
      return `${agent.name} 发言`;
    },
    onEvent: (event) => events.push(event)
  });

  const openingIndex = events.findIndex((event) => event.role === "moderator" && event.agentTitle === "开题");
  const firstGuidanceIndex = events.findIndex((event) => event.role === "moderator" && event.agentTitle === "引导下一轮");
  const firstVoteIndex = events.findIndex((event) => event.type === "vote");
  const finalIndex = events.findIndex((event) => event.type === "final");
  const supplementIndex = events.findIndex((event) => event.agentTitle === "一句补充");

  assert.ok(openingIndex >= 0);
  assert.ok(firstGuidanceIndex > openingIndex);
  assert.ok(firstVoteIndex > firstGuidanceIndex);
  assert.ok(finalIndex > firstVoteIndex);
  assert.ok(supplementIndex > finalIndex);
});

test("continueDiscussion strips old conclusion tail before fresh votes and final", async () => {
  const events = [];
  const transcript = [
    { role: "participant", agentId: "agent-1", agentName: "甲", agentTitle: "模型", content: "先做小版本。", round: 1 },
    { role: "vote", agentId: "agent-1", agentName: "甲", agentTitle: "投票", content: "旧票", stance: "旧票", round: 2 },
    { role: "final", agentId: "final", agentName: "掌议人", agentTitle: "定案", content: "旧结论", round: 2 },
    { role: "participant", agentId: "agent-1", agentName: "甲", agentTitle: "一句补充", content: "旧补充", round: 2 }
  ];

  await continueDiscussion({
    topic: "是否继续写公众号",
    transcript,
    rounds: 1,
    provider: async ({ mode, agent, transcript: seenTranscript }) => {
      assert.equal(seenTranscript.some((item) => item.content === "旧结论" || item.content === "旧票" || item.content === "旧补充"), false);
      if (mode === "vote") return `{"stance":"继续写","reason":"${agent.name}认为值得","action":"先写提纲"}`;
      if (mode === "final") return "新结论";
      if (mode === "supplement") return "补一句，先写小稿。";
      return "新发言";
    },
    onEvent: (event) => events.push(event)
  });

  assert.equal(events.filter((event) => event.type === "vote").length, 3);
  assert.equal(events.filter((event) => event.type === "final").length, 1);
  assert.equal(events.filter((event) => event.type === "message" && event.agentTitle === "一句补充").length, 3);
});

test("runDiscussion asks each model for one concise supplement after final summary", async () => {
  const events = [];

  await runDiscussion({
    topic: "救猫还是救画",
    rounds: 1,
    provider: async ({ mode, agent }) => {
      if (mode === "final") return "最终救猫。";
      if (mode === "supplement") return `${agent.name}补一句：别把象征价值压过眼前生命。`;
      return "我偏救猫，因为生命不可逆。";
    },
    onEvent: (event) => events.push(event)
  });

  const finalIndex = events.findIndex((event) => event.type === "final");
  const supplements = events.filter((event) => event.type === "message" && event.agentTitle === "一句补充");
  assert.equal(supplements.length, 3);
  assert.ok(events.findIndex((event) => event.agentTitle === "一句补充") > finalIndex);
});

test("runDiscussion routes moderator and final summary to Claude host model", async () => {
  const routed = [];

  await runDiscussion({
    topic: "救猫还是救画",
    rounds: 2,
    moderatorStartRound: 1,
    provider: async ({ agent, mode }) => {
      routed.push({ mode, clientId: agent.clientId });
      if (mode === "moderator") {
        return '{"directive":"下一轮请直接压到最终取舍。"}';
      }
      if (mode === "final") return "最终救猫。";
      return "我偏救猫，因为生命不可逆。";
    }
  });

  assert.equal(routed.find((item) => item.mode === "moderator").clientId, "aihubmix-claude-sonnet-4-6-think");
  assert.equal(routed.find((item) => item.mode === "opening").clientId, "aihubmix-claude-sonnet-4-6-think");
  assert.equal(routed.find((item) => item.mode === "final").clientId, "aihubmix-claude-sonnet-4-6-think");
});

test("runDiscussion records private model votes before final summary", async () => {
  const events = [];
  const voteTranscriptLengths = [];

  await runDiscussion({
    topic: "初一学习要不要加压",
    rounds: 1,
    provider: async ({ mode, agent, transcript }) => {
      if (mode === "vote") {
        voteTranscriptLengths.push(transcript.filter((item) => item.role === "vote" || item.type === "vote").length);
        return `{"stance":"先降负荷","reason":"${agent.name}认为已超载","action":"设停笔线"}`;
      }
      if (mode === "final") return "最终先降负荷。";
      return "我偏先降负荷。";
    },
    onEvent: (event) => events.push(event)
  });

  const votes = events.filter((event) => event.type === "vote");
  const finalIndex = events.findIndex((event) => event.type === "final");
  assert.equal(votes.length, 3);
  assert.equal(votes[0].stance, "先降负荷");
  assert.ok(events.findIndex((event) => event.type === "vote") < finalIndex);
  assert.deepEqual(voteTranscriptLengths, [0, 0, 0]);
});

test("createMockProvider returns usable participant, moderator, and final messages", async () => {
  const provider = createMockProvider();

  const participant = await provider({
    topic: "每天喝咖啡对人体有没有危害",
    agent: { id: "a", name: "甲" },
    round: 1,
    transcript: []
  });
  const moderator = await provider({
    topic: "每天喝咖啡对人体有没有危害",
    agent: { id: "moderator", name: "中间人" },
    round: 1,
    transcript: [],
    mode: "moderator"
  });
  const final = await provider({
    topic: "每天喝咖啡对人体有没有危害",
    agent: { id: "final", name: "共同结论" },
    round: 1,
    transcript: [],
    mode: "final"
  });
  const opening = await provider({
    topic: "每天喝咖啡对人体有没有危害",
    agent: { id: "moderator", name: "掌议人" },
    round: 0,
    transcript: [],
    mode: "opening"
  });

  assert.match(participant, /瞎说|值不值|好主意/);
  assert.match(moderator, /shouldIntervene/);
  assert.match(final, /定案|谋士分布|低成本/);
  assert.match(opening, /题目|冲突|决策|桌面/);
});

test("buildModeratorOpeningMessages keeps a consistent host persona", () => {
  const messages = buildModeratorOpeningMessages({ topic: "五一节要不要带娃出游" });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /石渠/);
  assert.match(content, /案牍官|谋臣首席/);
  assert.match(content, /不要用固定格式/);
  assert.match(content, /帮助用户决策/);
  assert.match(content, /五一节要不要带娃出游/);
});

test("buildParticipantMessages asks for useful adviser speech", () => {
  const messages = buildParticipantMessages({
    topic: "五一节要不要带娃出游",
    agent: { id: "a", name: "甲", title: "第一位", instruction: "慢慢想" },
    round: 2,
    transcript: [
      { agentName: "乙", content: "我觉得不要去热门景区。" }
    ]
  });

  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /不是辩手/);
  assert.match(content, /谋士/);
  assert.match(content, /看清取舍/);
  assert.match(content, /观点先行/);
  assert.match(content, /提供增量/);
  assert.match(content, /最多使用一个专业词/);
  assert.match(content, /具体例子/);
  assert.match(content, /不要输出列表/);
});

test("buildParticipantMessages honors custom participant speech limit", () => {
  const messages = buildParticipantMessages({
    topic: "专家模型要不要展开讲",
    agent: { id: "a", name: "GPT 5.5", title: "专家", speechLimit: 500, maxChars: 500 },
    round: 1,
    transcript: []
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /单次发言上限是 500 个汉字/);
  assert.match(content, /这是上限，不是目标/);
  assert.match(content, /复杂时可以展开说清楚/);
});

test("buildVoteMessages asks each model for a strict private vote", () => {
  const messages = buildVoteMessages({
    topic: "初一学习要不要加压",
    agent: { name: "GPT 5.5" },
    transcript: [{ agentName: "GPT 5.5", content: "先睡觉，再补低效家教。" }]
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /私下投票单/);
  assert.match(content, /只输出 JSON/);
  assert.match(content, /"stance"/);
});

test("buildFinalMessages constrains vote counts to unique participants", () => {
  const messages = buildFinalMessages({
    topic: "救猫还是救画",
    transcript: [
      { role: "participant", agentName: "DeepSeek V4 Flash", content: "我先救画。" },
      { role: "participant", agentName: "Gemini 3.1 Flash Lite", content: "我救猫。" },
      { role: "participant", agentName: "DeepSeek V4 Flash", content: "想了下我转向救猫。" }
    ]
  });

  const content = messages.map((message) => message.content).join("\n");
  assert.match(content, /唯一参与者总数：2/);
  assert.match(content, /模型投票记录/);
  assert.match(content, /每个模型只能算 1 票/);
  assert.match(content, /各家短评/);
  assert.match(content, /不要写“掌议人观点”“主持人观点”/);
});

test("createOpenAICompatibleProvider can route different agents to different models", async () => {
  const calls = [];
  const provider = createOpenAICompatibleProvider({
    clients: {
      a: {
        apiKey: "key-a",
        baseUrl: "https://example-a.test/v1",
        model: "qwen3.6-plus",
        label: "百炼 Qwen"
      },
      b: {
        apiKey: "key-b",
        baseUrl: "https://example-b.test",
        model: "deepseek-v4-flash",
        label: "DeepSeek",
        thinking: true,
        reasoningEffort: "high"
      }
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "模型回复" } }] })
      };
    }
  });

  await provider({
    topic: "每天喝咖啡对人体有没有危害",
    agent: { id: "a", name: "甲", title: "第一位", instruction: "慢想" },
    round: 1,
    transcript: [],
    mode: "participant"
  });
  await provider({
    topic: "每天喝咖啡对人体有没有危害",
    agent: { id: "b", name: "乙", title: "第二位", instruction: "慢想" },
    round: 1,
    transcript: [],
    mode: "participant"
  });

  assert.equal(calls[0].url, "https://example-a.test/v1/chat/completions");
  assert.equal(calls[0].body.model, "qwen3.6-plus");
  assert.equal(calls[1].url, "https://example-b.test/chat/completions");
  assert.equal(calls[1].body.model, "deepseek-v4-flash");
  assert.deepEqual(calls[1].body.thinking, { type: "enabled" });
  assert.equal(calls[1].body.reasoning_effort, "high");
});

test("createOpenAICompatibleProvider does not silently mock an unconfigured selected model", async () => {
  const provider = createOpenAICompatibleProvider({
    clients: {
      configured: {
        apiKey: "key-a",
        baseUrl: "https://example-a.test/v1",
        model: "gemini-3.1-flash-lite-preview"
      },
      missing: {
        apiKey: "",
        baseUrl: "https://example-b.test/v1",
        model: "deepseek-v4-flash"
      }
    },
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  await assert.rejects(
    () => provider({
      topic: "五一节要不要带娃出游",
      agent: { id: "agent-1", name: "DeepSeek V4 Flash", clientId: "missing" },
      round: 1,
      transcript: [],
      mode: "participant"
    }),
    /模型未配置 API Key/
  );
});

test("createOpenAICompatibleProvider supports max_completion_tokens models", async () => {
  const calls = [];
  const provider = createOpenAICompatibleProvider({
    clients: {
      a: {
        apiKey: "key-a",
        baseUrl: "https://example-a.test/v1",
        model: "gpt-5.4-nano",
        tokenParam: "max_completion_tokens"
      }
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "模型回复" } }] })
      };
    }
  });

  await provider({
    topic: "五一节要不要带娃出游",
    agent: { id: "a", name: "GPT 5.4 Nano", title: "AIHubMix", clientId: "a" },
    round: 1,
    transcript: [],
    mode: "participant"
  });

  assert.equal(calls[0].body.max_tokens, undefined);
  assert.equal(typeof calls[0].body.max_completion_tokens, "number");
});

test("createOpenAICompatibleProvider supports Xiaomi MiMo web search clients", async () => {
  const calls = [];
  const provider = createOpenAICompatibleProvider({
    clients: {
      a: {
        apiKey: "key-a",
        baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
        model: "mimo-v2.5-pro",
        label: "MiMo V2.5 Pro",
        authHeader: "api-key",
        tokenParam: "max_completion_tokens",
        webSearch: true,
        webSearchMaxKeyword: 2,
        webSearchLimit: 2,
        forceSearch: false,
        systemPrefix: "你是MiMo。"
      }
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, headers: options.headers, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "模型回复" } }] })
      };
    }
  });

  await provider({
    topic: "今天要不要查实时资料",
    agent: { id: "a", name: "MiMo V2.5 Pro", title: "小米", clientId: "a" },
    round: 1,
    transcript: [],
    mode: "participant"
  });

  assert.equal(calls[0].headers["api-key"], "key-a");
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[0].body.max_tokens, undefined);
  assert.equal(typeof calls[0].body.max_completion_tokens, "number");
  assert.equal(calls[0].body.messages[0].content, "你是MiMo。");
  assert.equal(calls[0].body.tools[0].type, "web_search");
  assert.equal(calls[0].body.tools[0].force_search, false);
  assert.equal(calls[0].body.tools[0].user_location.city, "Hangzhou");
  assert.equal(calls[0].body.tool_choice, "auto");
  assert.deepEqual(calls[0].body.thinking, { type: "disabled" });
});

test("createOpenAICompatibleProvider expands participant token budget for custom speech limit", async () => {
  const calls = [];
  const provider = createOpenAICompatibleProvider({
    clients: {
      a: {
        apiKey: "key-a",
        baseUrl: "https://example-a.test/v1",
        model: "qwen3.5-plus"
      }
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "模型回复" } }] })
      };
    }
  });

  await provider({
    topic: "专家模型要不要展开讲",
    agent: { id: "a", name: "Qwen", title: "百炼", clientId: "a", speechLimit: 500, maxChars: 500 },
    round: 1,
    transcript: [],
    mode: "participant"
  });

  assert.ok(calls[0].body.max_tokens >= 1000);
});

test("createOpenAICompatibleProvider extracts visible content from array responses", async () => {
  const provider = createOpenAICompatibleProvider({
    clients: {
      a: {
        apiKey: "key-a",
        baseUrl: "https://example-a.test/v1",
        model: "gemini-3.1-pro-preview"
      }
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "数组" },
                { type: "text", text: "正文" }
              ]
            }
          }
        ]
      })
    })
  });

  const text = await provider({
    topic: "救猫还是救画",
    agent: { id: "a", name: "Gemini", title: "AIHubMix", clientId: "a" },
    round: 1,
    transcript: [],
    mode: "participant"
  });

  assert.equal(text, "数组正文");
});

test("createOpenAICompatibleProvider retries once when expert model returns no visible content", async () => {
  const calls = [];
  const provider = createOpenAICompatibleProvider({
    clients: {
      a: {
        apiKey: "key-a",
        baseUrl: "https://example-a.test/v1",
        model: "gpt-5.5",
        label: "GPT 5.5",
        tier: "expert",
        tokenParam: "max_completion_tokens"
      }
    },
    fetchImpl: async (url, options) => {
      calls.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => calls.length === 1
          ? ({ choices: [{ finish_reason: "length", message: { content: "" } }] })
          : ({ choices: [{ message: { content: "重试后的正文" } }] })
      };
    }
  });

  const text = await provider({
    topic: "救猫还是救画",
    agent: { id: "a", name: "GPT 5.5", title: "AIHubMix", clientId: "a" },
    round: 1,
    transcript: [],
    mode: "participant"
  });

  assert.equal(text, "重试后的正文");
  assert.equal(calls.length, 2);
  assert.ok(calls[1].max_completion_tokens > calls[0].max_completion_tokens);
  assert.match(calls[1].messages.at(-1).content, /被截断/);
});

test("createOpenAICompatibleProvider treats empty length responses as truncated", async () => {
  const calls = [];
  const provider = createOpenAICompatibleProvider({
    clients: {
      a: {
        apiKey: "key-a",
        baseUrl: "https://example-a.test/v1",
        model: "mimo-v2.5-pro",
        label: "MiMo V2.5 Pro",
        tokenParam: "max_completion_tokens",
        expandedOutput: true
      }
    },
    fetchImpl: async (url, options) => {
      calls.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => calls.length === 1
          ? ({ choices: [{ finish_reason: "length", message: { content: "", role: "assistant", tool_calls: null } }] })
          : ({ choices: [{ finish_reason: "stop", message: { content: "重试后完整正文" } }] })
      };
    }
  });

  const text = await provider({
    topic: "长文是否会截断",
    agent: { id: "a", name: "MiMo V2.5 Pro", title: "小米", clientId: "a" },
    round: 1,
    transcript: [],
    mode: "final"
  });

  assert.equal(text, "重试后完整正文");
  assert.ok(calls[1].max_completion_tokens >= Math.ceil(calls[0].max_completion_tokens * 2));
  assert.match(calls[1].messages.at(-1).content, /被截断/);
});

test("createOpenAICompatibleProvider retries when expert visible content is truncated", async () => {
  const calls = [];
  const provider = createOpenAICompatibleProvider({
    clients: {
      a: {
        apiKey: "key-a",
        baseUrl: "https://example-a.test/v1",
        model: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro Preview",
        tier: "expert",
        reasoningEffort: "high"
      }
    },
    fetchImpl: async (url, options) => {
      calls.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => calls.length === 1
          ? ({ choices: [{ finish_reason: "length", message: { content: "我偏救猫，因为" } }] })
          : ({ choices: [{ finish_reason: "stop", message: { content: "我偏救猫，因为眼前生命不可逆。" } }] })
      };
    }
  });

  const text = await provider({
    topic: "救猫还是救画",
    agent: { id: "a", name: "Gemini", title: "AIHubMix", clientId: "a" },
    round: 1,
    transcript: [],
    mode: "participant"
  });

  assert.equal(text, "我偏救猫，因为眼前生命不可逆。");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].reasoning_effort, "high");
  assert.ok(calls[1].max_tokens > calls[0].max_tokens);
  assert.match(calls[1].messages.at(-1).content, /被截断/);
});
