# 石渠

> 高阶智能体的思辨推演

**项目状态：暂时归档（2026-10-03）。** NAS 服务已停止，代码、容器、镜像和配置保留，不再主动维护。重新启用前请先看 [交接文档](docs/HANDOFF.md) 中的恢复步骤，并核对 API 账户和模型可用性。

石渠不是普通 AI 聊天室，也不是让几个模型互相抬杠的辩论场。

它更像一间安静的谋士厅：你抛出一个问题，几位模型谋士轮流思考，彼此读过前文后再补充判断。它们可以一致，也可以分歧，但目标只有一个：帮你把问题看清楚，把取舍压实，最后形成一份能拿来行动的定案。

名字取“石渠”，有一点旧时典籍、秘阁议事的味道。它适合那些没有标准答案、但你又真的想想明白的问题：要不要带娃出游、某个产品方向值不值得做、AI 行业下一步怎么走、一次选择背后真正的代价是什么。

## 它在做什么

- 多模型轮流议事：支持 2 到 8 位谋士，模型来自小米 MiMo 与 AIHubMix。
- 掌议人控场：开题、轮间收窄、最终定案，避免讨论散掉。
- 不是固定立场：模型默认不是正反方，而是共同帮你决策。
- 人设谋士：内置军师、长史、逆耳谋士、裁断官、斥候、风控官、史官、侦探等角色，也支持自定义。
- 观点先行：每位谋士先亮观点，再讲原因和边界。
- 私下投票：最终统计只按每个模型最后的投票算，避免重复计票。
- 续聊机制：结论之后还能插入新想法，让谋士继续推演。
- AI 生图：可调用 RunningHub 生成适合保存或分享的定案图。
- NAS 友好：一个 Node 服务，一个 Docker Compose 文件，适合放在家用 NAS 上常驻。

## 当前模型池

默认配置里保留了同一个模型池，不再区分“专家级/普通级”：

- MiMo V2.5 Pro
- MiMo V2.5
- MiMo V2 Pro
- GPT 5.5
- Sonnet 4.6
- Gemini 3.1 Pro
- Grok 4
- GPT 5.4 Nano
- Gemini 3.1 Lite
- DeepSeek V4 Flash

如果没有配置 API Key，项目会进入 mock 模式，方便先看界面和流程。

## 快速启动

```bash
cp .env.example .env.local
node server/index.mjs
```

打开：

```text
http://localhost:5173
```

## 环境变量

```env
PORT=5173

MIMO_API_KEY=
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_ENABLE_WEB_SEARCH=false
MIMO_FORCE_SEARCH=false

AIHUBMIX_API_KEY=
AIHUBMIX_BASE_URL=https://aihubmix.com/v1

RUNNINGHUB_API_KEY=
```

说明：

- `MIMO_API_KEY` 用于小米 MiMo Token Plan 或兼容 API。
- `AIHUBMIX_API_KEY` 用于 GPT、Claude、Gemini、Grok、DeepSeek 等模型。
- `RUNNINGHUB_API_KEY` 用于 AI 生图。
- 当前实测 Token Plan 通道可以正常文本调用，但 `web_search tools` 可能返回 `Param Incorrect`，所以默认关闭联网工具。

## Docker 部署

```bash
docker compose up -d --build
```

服务端口默认是 `5173`。在 NAS 上部署时，把 `.env.local` 放在项目目录即可。

## 测试

```bash
node --test tests/*.test.mjs
```

## 项目结构

```text
server/
  discussion.mjs  # 议事流程、提示词、模型路由
  env.mjs         # 模型配置与环境变量
  index.mjs       # HTTP API 与静态服务
  runninghub.mjs  # RunningHub AI 生图

public/
  index.html
  app.js
  styles.css
  scenes/         # 四套场景背景

docs/
  HANDOFF.md      # 给下一次 Codex 对话看的交接文档
  prompts.md      # 提示词设计说明
```

## 一句话

石渠想做的不是“让 AI 多说几句”，而是让一群足够聪明的模型替你把一个问题反复照亮，最后留下一句真正能用的判断。
