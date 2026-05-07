import test from "node:test";
import assert from "node:assert/strict";

import { getConfig } from "../server/env.mjs";

test("getConfig exposes one mixed model pool without visible tiers", () => {
  const config = getConfig();
  const ids = config.publicModels.map((model) => model.id);

  assert.deepEqual(ids, [
    "mimo-v2.5-pro",
    "mimo-v2.5",
    "mimo-v2-pro",
    "aihubmix-gpt-5.5",
    "aihubmix-claude-sonnet-4-6-think",
    "aihubmix-gemini-3.1-pro-preview",
    "aihubmix-grok-4",
    "aihubmix-gpt-5.4-nano",
    "aihubmix-gemini-3.1-flash-lite-preview",
    "aihubmix-deepseek-v4-flash"
  ]);
  assert.ok(config.publicModels.every((model) => model.tier === undefined));
  assert.ok(config.publicModels.some((model) => model.provider === "小米"));
  assert.ok(config.publicModels.some((model) => model.provider === "AIHubMix"));
  assert.equal(config.clientCatalog["mimo-v2.5-pro"].authHeader, "api-key");
  assert.equal(config.clientCatalog["mimo-v2.5-pro"].tokenParam, "max_completion_tokens");
  assert.equal(config.clientCatalog["mimo-v2.5-pro"].webSearch, false);
  assert.equal(config.clientCatalog["aihubmix-claude-sonnet-4-6-think"].expandedOutput, true);
});
