import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRunningHubPosterPrompt,
  createRunningHubPoster
} from "../server/runninghub.mjs";

test("buildRunningHubPosterPrompt creates a poster-oriented prompt", () => {
  const prompt = buildRunningHubPosterPrompt({
    topic: "救猫还是救画",
    finalText: "主持人倾向救猫，因为生命不可逆。",
    transcript: [
      { role: "participant", agentName: "Gemini", content: "救猫，眼前生命优先。" }
    ]
  });

  assert.match(prompt, /竖版 9:16/);
  assert.match(prompt, /只允许 4 个文字区/);
  assert.match(prompt, /禁止任何被裁切、压缩/);
  assert.match(prompt, /不要做成单独右侧小卡片/);
  assert.match(prompt, /禁止发明百分比/);
  assert.match(prompt, /救猫还是救画/);
  assert.match(prompt, /Gemini/);
  assert.doesNotMatch(prompt, /主持人倾向/);
  assert.doesNotMatch(prompt, /5-7 个清晰信息块/);
});

test("createRunningHubPoster submits, polls, and downloads image", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    if (url.endsWith("/text-to-image")) {
      return jsonResponse({ taskId: "task-1", status: "RUNNING" });
    }
    if (url.endsWith("/query")) {
      return jsonResponse({
        taskId: "task-1",
        status: "SUCCESS",
        results: [{ url: "https://example.test/image.png", outputType: "png" }]
      });
    }
    if (url === "https://example.test/image.png") {
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
      };
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const poster = await createRunningHubPoster({
    apiKey: "key",
    topic: "救猫还是救画",
    finalText: "救猫。",
    transcript: [],
    fetchImpl,
    pollIntervalMs: 1
  });

  assert.equal(poster.taskId, "task-1");
  assert.equal(poster.contentType, "image/png");
  assert.deepEqual([...poster.buffer], [1, 2, 3]);
  assert.equal(calls[0].body.aspectRatio, "9:16");
  assert.equal(calls[0].body.resolution, "1k");
});

function jsonResponse(payload) {
  return {
    ok: true,
    text: async () => JSON.stringify(payload)
  };
}
