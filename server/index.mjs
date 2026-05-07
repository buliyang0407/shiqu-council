import { createReadStream, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getConfig } from "./env.mjs";
import {
  createDefaultAgents,
  createOpenAICompatibleProvider,
  continueDiscussion,
  normalizeAgents,
  personaPresets,
  runConclusion,
  runDiscussion,
  runSingleTurn
} from "./discussion.mjs";
import { createRunningHubPoster } from "./runninghub.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname, "..");
const publicDir = join(rootDir, "public");
const config = getConfig();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const jobs = new Map();
const jobTtlMs = 30 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - jobTtlMs;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000).unref();

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const requestPath = requestUrl.pathname;

    if (request.method === "POST" && requestPath === "/api/discuss-job") {
      await handleDiscussJob(request, response);
      return;
    }

    if (request.method === "POST" && requestPath === "/api/turn-job") {
      await handleTurnJob(request, response);
      return;
    }

    if (request.method === "GET" && requestPath.startsWith("/api/jobs/")) {
      handleJobPoll(requestUrl, response);
      return;
    }

    if (request.method === "POST" && requestPath === "/api/discuss") {
      await handleDiscussBatch(request, response);
      return;
    }

    if (request.method === "POST" && requestPath === "/api/discuss-stream") {
      await handleDiscussStream(request, response);
      return;
    }

    if (request.method === "POST" && requestPath === "/api/turn") {
      await handleTurnBatch(request, response);
      return;
    }

    if (request.method === "POST" && requestPath === "/api/conclude-stream") {
      await handleConclusionStream(request, response);
      return;
    }

    if (request.method === "POST" && requestPath === "/api/turn-stream") {
      await handleTurnStream(request, response);
      return;
    }

    if (request.method === "POST" && requestPath === "/api/share-poster") {
      await handleSharePoster(request, response);
      return;
    }

    if (request.method === "GET" && requestPath === "/api/config") {
      sendJson(response, 200, {
        mode: config.hasApiKey ? "api" : "mock",
        models: config.publicModels,
        defaultAgents: createDefaultAgents(config.publicModels),
        personaPresets,
        hasRunningHub: config.hasRunningHubKey
      });
      return;
    }

    if (request.method === "GET") {
      serveStatic(request, response);
      return;
    }

    sendJson(response, 405, { error: "method not allowed" });
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, 500, { error: error.message || "internal server error" });
    } else {
      writeSse(response, "error", { message: error.message || "internal server error" });
      response.end();
    }
  }
});

server.listen(config.port, () => {
  const mode = config.hasApiKey ? "API" : "mock";
  console.log(`AI discussion room running at http://localhost:${config.port}`);
  console.log(`Provider mode: ${mode}`);
});

async function handleDiscussJob(request, response) {
  const body = await readJsonBody(request);
  const topic = String(body.topic || "").trim();
  const rounds = clamp(Number(body.rounds || 1), 1, 6);
  const agents = normalizeAgents(body.agents || [], config.publicModels, body.count || body.agents?.length || 3);

  if (!topic) {
    sendJson(response, 400, { error: "topic is required" });
    return;
  }

  const job = createJob();
  sendJson(response, 202, { jobId: job.id });
  runJob(job, async (onEvent) => {
    onEvent({
      type: "meta",
      mode: config.hasApiKey ? "api" : "mock",
      models: config.publicModels
    });
    await runDiscussion({
      topic,
      rounds,
      agents,
      provider: createOpenAICompatibleProvider({ clientCatalog: config.clientCatalog }),
      onEvent
    });
  });
}

async function handleTurnJob(request, response) {
  const body = await readJsonBody(request);
  const topic = String(body.topic || "").trim();
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const agents = normalizeAgents(body.agents || [], config.publicModels, body.count || body.agents?.length || 3);
  const agentIndex = clamp(Number(body.agentIndex ?? transcript.length % agents.length), 0, agents.length - 1);
  const userInput = String(body.userInput || "").trim();

  if (!topic) {
    sendJson(response, 400, { error: "topic is required" });
    return;
  }
  if (!userInput) {
    sendJson(response, 400, { error: "user input is required" });
    return;
  }

  const job = createJob();
  sendJson(response, 202, { jobId: job.id });
  runJob(job, async (onEvent) => {
    onEvent({ type: "meta", mode: config.hasApiKey ? "api" : "mock", models: config.publicModels });
    await continueDiscussion({
      topic,
      agents,
      transcript,
      rounds: clamp(Number(body.rounds || 1), 1, 2),
      startIndex: agentIndex,
      provider: createOpenAICompatibleProvider({ clientCatalog: config.clientCatalog }),
      onEvent
    });
  });
}

function handleJobPoll(requestUrl, response) {
  const jobId = decodeURIComponent(requestUrl.pathname.replace("/api/jobs/", ""));
  const job = jobs.get(jobId);
  if (!job) {
    sendJson(response, 404, { error: "job not found" });
    return;
  }
  const after = Number(requestUrl.searchParams.get("after") || 0);
  sendJson(response, 200, {
    jobId,
    done: job.done,
    events: job.events.filter((event) => event.seq > after)
  });
}

function createJob() {
  const job = {
    id: randomUUID(),
    createdAt: Date.now(),
    done: false,
    nextSeq: 1,
    events: []
  };
  jobs.set(job.id, job);
  return job;
}

function runJob(job, runner) {
  queueMicrotask(async () => {
    const onEvent = (event) => {
      job.events.push({ ...event, seq: job.nextSeq++ });
    };
    try {
      await runner(onEvent);
      onEvent({ type: "done", ok: true });
    } catch (error) {
      onEvent({ type: "error", message: error.message || "job failed" });
    } finally {
      job.done = true;
    }
  });
}

async function handleDiscussBatch(request, response) {
  const body = await readJsonBody(request);
  const topic = String(body.topic || "").trim();
  const rounds = clamp(Number(body.rounds || 1), 1, 6);
  const agents = normalizeAgents(body.agents || [], config.publicModels, body.count || body.agents?.length || 3);

  if (!topic) {
    sendJson(response, 400, { error: "topic is required" });
    return;
  }

  const events = [{
    type: "meta",
    mode: config.hasApiKey ? "api" : "mock",
    models: config.publicModels
  }];
  const provider = createOpenAICompatibleProvider({ clientCatalog: config.clientCatalog });

  try {
    await runDiscussion({
      topic,
      rounds,
      agents,
      provider,
      onEvent: (event) => events.push(event)
    });
    events.push({ type: "done", ok: true });
  } catch (error) {
    events.push({ type: "error", message: error.message || "discussion failed" });
  }

  sendJson(response, 200, { events });
}

async function handleDiscussStream(request, response) {
  const body = await readJsonBody(request);
  const topic = String(body.topic || "").trim();
  const rounds = clamp(Number(body.rounds || 1), 1, 6);
  const agents = normalizeAgents(body.agents || [], config.publicModels, body.count || body.agents?.length || 3);

  if (!topic) {
    sendJson(response, 400, { error: "topic is required" });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const controller = new AbortController();
  let completed = false;
  response.on("close", () => {
    if (!completed) controller.abort();
  });

  const provider = createOpenAICompatibleProvider({
    clientCatalog: config.clientCatalog
  });

  writeSse(response, "meta", {
    mode: config.hasApiKey ? "api" : "mock",
    models: config.publicModels
  });

  try {
    await runDiscussion({
      topic,
      rounds,
      agents,
      provider,
      signal: controller.signal,
      onEvent: (event) => writeSse(response, event.type, event)
    });
    writeSse(response, "done", { ok: true });
  } catch (error) {
    if (!controller.signal.aborted) {
      writeSse(response, "error", { message: error.message || "discussion failed" });
    }
  } finally {
    completed = true;
    response.end();
  }
}

async function handleConclusionStream(request, response) {
  const body = await readJsonBody(request);
  const topic = String(body.topic || "").trim();
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const agents = normalizeAgents(body.agents || [], config.publicModels, body.count || body.agents?.length || 3);

  if (!topic) {
    sendJson(response, 400, { error: "topic is required" });
    return;
  }

  const { controller, provider } = openStream(response);
  writeSse(response, "meta", { mode: config.hasApiKey ? "api" : "mock", models: config.publicModels });

  try {
    await runConclusion({
      topic,
      transcript,
      agents,
      provider,
      signal: controller.signal,
      onEvent: (event) => writeSse(response, event.type, event)
    });
    writeSse(response, "done", { ok: true });
  } catch (error) {
    if (!controller.signal.aborted) writeSse(response, "error", { message: error.message || "conclusion failed" });
  } finally {
    response.end();
  }
}

async function handleTurnStream(request, response) {
  const body = await readJsonBody(request);
  const topic = String(body.topic || "").trim();
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const agents = normalizeAgents(body.agents || [], config.publicModels, body.count || body.agents?.length || 3);
  const agentIndex = clamp(Number(body.agentIndex ?? transcript.length % agents.length), 0, agents.length - 1);
  const userInput = String(body.userInput || "").trim();

  if (!topic) {
    sendJson(response, 400, { error: "topic is required" });
    return;
  }
  if (!userInput) {
    sendJson(response, 400, { error: "user input is required" });
    return;
  }

  const { controller, provider } = openStream(response);
  writeSse(response, "meta", { mode: config.hasApiKey ? "api" : "mock", models: config.publicModels });

  try {
    await continueDiscussion({
      topic,
      agents,
      transcript,
      rounds: clamp(Number(body.rounds || 1), 1, 2),
      startIndex: agentIndex,
      provider,
      signal: controller.signal,
      onEvent: (event) => writeSse(response, event.type, event)
    });
    writeSse(response, "done", { ok: true });
  } catch (error) {
    if (!controller.signal.aborted) writeSse(response, "error", { message: error.message || "turn failed" });
  } finally {
    response.end();
  }
}

async function handleTurnBatch(request, response) {
  const body = await readJsonBody(request);
  const topic = String(body.topic || "").trim();
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const agents = normalizeAgents(body.agents || [], config.publicModels, body.count || body.agents?.length || 3);
  const agentIndex = clamp(Number(body.agentIndex ?? transcript.length % agents.length), 0, agents.length - 1);
  const userInput = String(body.userInput || "").trim();

  if (!topic) {
    sendJson(response, 400, { error: "topic is required" });
    return;
  }
  if (!userInput) {
    sendJson(response, 400, { error: "user input is required" });
    return;
  }

  const events = [{ type: "meta", mode: config.hasApiKey ? "api" : "mock", models: config.publicModels }];
  const provider = createOpenAICompatibleProvider({ clientCatalog: config.clientCatalog });

  try {
    await continueDiscussion({
      topic,
      agents,
      transcript,
      rounds: clamp(Number(body.rounds || 1), 1, 2),
      startIndex: agentIndex,
      provider,
      onEvent: (event) => events.push(event)
    });
    events.push({ type: "done", ok: true });
  } catch (error) {
    events.push({ type: "error", message: error.message || "turn failed" });
  }

  sendJson(response, 200, { events });
}

async function handleSharePoster(request, response) {
  const body = await readJsonBody(request);
  const topic = String(body.topic || "").trim();
  const finalText = String(body.finalText || "").trim();
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];

  if (!topic) {
    sendJson(response, 400, { error: "topic is required" });
    return;
  }
  if (!finalText) {
    sendJson(response, 400, { error: "final text is required" });
    return;
  }

  const controller = new AbortController();
  let completed = false;
  response.on("close", () => {
    if (!completed) controller.abort();
  });

  try {
    const poster = await createRunningHubPoster({
      apiKey: config.runningHubKey,
      topic,
      finalText,
      transcript,
      signal: controller.signal
    });
    response.writeHead(200, {
      "Content-Type": poster.contentType,
      "Cache-Control": "no-store",
      "X-RunningHub-Task-Id": poster.taskId
    });
    completed = true;
    response.end(poster.buffer);
  } catch (error) {
    if (!response.headersSent) {
      completed = true;
      sendJson(response, 500, { error: error.message || "poster generation failed" });
    }
  }
}

function openStream(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const controller = new AbortController();
  let completed = false;
  response.on("close", () => {
    if (!completed) controller.abort();
  });
  const originalEnd = response.end.bind(response);
  response.end = (...args) => {
    completed = true;
    return originalEnd(...args);
  };

  return {
    controller,
    provider: createOpenAICompatibleProvider({ clientCatalog: config.clientCatalog })
  };
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    sendJson(response, 404, { error: "not found" });
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-cache"
  });
  createReadStream(filePath).pipe(response);
}

function writeSse(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 300_000) throw new Error("request body too large");
  }
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
