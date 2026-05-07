import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvFile(filePath = ".env.local") {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) return {};

  const values = {};
  const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = stripQuotes(rawValue);

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
    if (key) values[key] = value;
  }

  return values;
}

export function getConfig() {
  loadEnvFile();

  const mimoKey = process.env.MIMO_API_KEY || process.env.XIAOMI_MIMO_API_KEY || "";
  const mimoBaseUrl =
    process.env.MIMO_BASE_URL ||
    process.env.XIAOMI_MIMO_BASE_URL ||
    "https://token-plan-cn.xiaomimimo.com/v1";
  const mimoWebSearchEnabled = parseBoolean(process.env.MIMO_ENABLE_WEB_SEARCH || "false");
  const aihubmixKey = process.env.AIHUBMIX_API_KEY || "";
  const runningHubKey = process.env.RUNNINGHUB_API_KEY || "";

  const catalog = [
    mimo("mimo-v2.5-pro", "MiMo V2.5 Pro", "mimo-v2.5-pro", mimoKey, mimoBaseUrl, { timeoutMs: 120_000, webSearch: mimoWebSearchEnabled }),
    mimo("mimo-v2.5", "MiMo V2.5", "mimo-v2.5", mimoKey, mimoBaseUrl, { timeoutMs: 90_000, webSearch: mimoWebSearchEnabled }),
    mimo("mimo-v2-pro", "MiMo V2 Pro", "mimo-v2-pro", mimoKey, mimoBaseUrl, { timeoutMs: 120_000, webSearch: mimoWebSearchEnabled }),
    aihubmix("aihubmix-gpt-5.5", "GPT 5.5", "gpt-5.5", aihubmixKey, { tokenParam: "max_completion_tokens", reasoningEffort: "high", expandedOutput: true, timeoutMs: 120_000 }),
    aihubmix("aihubmix-claude-sonnet-4-6-think", "Sonnet 4.6", "claude-sonnet-4-6-think", aihubmixKey, { expandedOutput: true, timeoutMs: 120_000 }),
    aihubmix("aihubmix-gemini-3.1-pro-preview", "Gemini 3.1 Pro", "gemini-3.1-pro-preview", aihubmixKey, { reasoningEffort: "high", expandedOutput: true, timeoutMs: 120_000 }),
    aihubmix("aihubmix-grok-4", "Grok 4", "grok-4", aihubmixKey, { expandedOutput: true, timeoutMs: 120_000 }),
    aihubmix("aihubmix-gpt-5.4-nano", "GPT 5.4 Nano", "gpt-5.4-nano", aihubmixKey, { tokenParam: "max_completion_tokens", timeoutMs: 60_000 }),
    aihubmix("aihubmix-gemini-3.1-flash-lite-preview", "Gemini 3.1 Lite", "gemini-3.1-flash-lite-preview", aihubmixKey, { timeoutMs: 60_000 }),
    aihubmix("aihubmix-deepseek-v4-flash", "DeepSeek V4 Flash", "deepseek-v4-flash", aihubmixKey, { timeoutMs: 60_000 })
  ];

  const clientCatalog = Object.fromEntries(catalog.map((client) => [client.id, client]));
  const publicModels = catalog.map(({ id, label, provider, model, available, webSearch }) => ({
    id,
    label,
    provider,
    model,
    available,
    webSearch
  }));

  return {
    port: Number(process.env.PORT || 5173),
    clientCatalog,
    publicModels,
    hasApiKey: catalog.some((client) => client.available),
    runningHubKey,
    hasRunningHubKey: Boolean(runningHubKey)
  };
}

function mimo(id, label, model, apiKey, baseUrl, options = {}) {
  return {
    id,
    label,
    provider: "小米",
    apiKey,
    baseUrl,
    model,
    authHeader: "api-key",
    tokenParam: "max_completion_tokens",
    webSearch: false,
    webSearchMaxKeyword: 2,
    webSearchLimit: 2,
    forceSearch: parseBoolean(process.env.MIMO_FORCE_SEARCH || "false"),
    systemPrefix: buildMimoSystemPrefix(),
    available: Boolean(apiKey),
    ...options
  };
}

function aihubmix(id, label, model, apiKey, options = {}) {
  return {
    id,
    label,
    provider: "AIHubMix",
    apiKey,
    baseUrl: process.env.AIHUBMIX_BASE_URL || "https://aihubmix.com/v1",
    model,
    available: Boolean(apiKey),
    ...options
  };
}

function parseBoolean(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

function buildMimoSystemPrefix() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const week = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "long"
  }).format(now);
  return `你是MiMo（中文名称也是MiMo），是小米公司研发的AI智能助手。今天的日期：${date} ${week}，你的知识截止日期是2024年12月。`;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
