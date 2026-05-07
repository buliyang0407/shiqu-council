# 石渠项目交接文档

下一个对话直接让 Codex 先看这个文件：

```text
/Users/buliyang/零星/3kingdom/docs/HANDOFF.md
```

## 项目一句话

石渠是一个多模型谋士议事工具。用户提出问题，多个 AI 模型像谋士一样轮流分析，掌议人负责开题、控场和定案，最终给用户一个更适合决策的结论。

它不是辩论场，也不是多 AI 群聊。核心目标是：帮用户看清问题、压实取舍、得到可行动判断。

## 当前重要状态

- 本地项目目录：`/Users/buliyang/零星/3kingdom`
- NAS 部署目录：`/volume1/docker/3kingdom`
- NAS 访问地址：`http://192.168.3.71:5173`
- Docker 容器名：`shiqu-3kingdom`
- 服务端口：`5173`
- 当前日期上下文：项目最近一轮稳定部署在 2026-05-06 晚间完成。

## 当前模型策略

不再区分“专家级/普通级”，所有模型放在同一个下拉池里。

当前模型池在 `server/env.mjs`：

- `mimo-v2.5-pro` -> MiMo V2.5 Pro
- `mimo-v2.5` -> MiMo V2.5
- `mimo-v2-pro` -> MiMo V2 Pro
- `aihubmix-gpt-5.5` -> GPT 5.5
- `aihubmix-claude-sonnet-4-6-think` -> Sonnet 4.6
- `aihubmix-gemini-3.1-pro-preview` -> Gemini 3.1 Pro
- `aihubmix-grok-4` -> Grok 4
- `aihubmix-gpt-5.4-nano` -> GPT 5.4 Nano
- `aihubmix-gemini-3.1-flash-lite-preview` -> Gemini 3.1 Lite
- `aihubmix-deepseek-v4-flash` -> DeepSeek V4 Flash

默认参与者顺序在 `server/discussion.mjs`：

```js
const defaultModelIds = [
  "mimo-v2.5-pro",
  "aihubmix-gpt-5.5",
  "aihubmix-claude-sonnet-4-6-think",
  "aihubmix-gemini-3.1-pro-preview",
  "aihubmix-grok-4",
  "mimo-v2.5",
  "mimo-v2-pro"
];
```

掌议人固定走：

```js
const moderatorClientId = "aihubmix-claude-sonnet-4-6-think";
```

## 密钥和环境变量

密钥只在 `.env.local` 和 NAS 对应 `.env.local`，不要提交到 Git。

`.env.example` 只保留空位：

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

注意：小米 MiMo Token Plan 文档和控制台显示支持 Web Search 插件，但实测 Token Plan key 在 `token-plan-cn` 通道中，只要请求带 `tools: web_search` 就返回 `400 Param Incorrect`。所以当前默认：

```env
MIMO_ENABLE_WEB_SEARCH=false
```

普通文本调用是正常的。

## 运行方式

本地：

```bash
node server/index.mjs
```

测试：

```bash
node --test tests/*.test.mjs
```

Docker：

```bash
docker compose up -d --build
```

NAS 上重启：

```bash
cd /volume1/docker/3kingdom
sudo docker compose up -d --build app
```

## 主要文件

- `server/discussion.mjs`
  - 议事流程
  - 默认模型顺序
  - 掌议人模型
  - 人设预设
  - 谋士发言提示词
  - 掌议人开场、轮间引导、最终定案
  - 私下投票和定案后补一句

- `server/env.mjs`
  - 环境变量读取
  - 模型池配置
  - MiMo / AIHubMix 客户端配置

- `server/index.mjs`
  - HTTP API
  - 静态页面服务
  - Job polling 兼容远程访问
  - `/api/share-poster` RunningHub 生图接口

- `server/runninghub.mjs`
  - RunningHub `rhart-image-g-2/text-to-image`
  - 轮询、下载图片
  - 生图 prompt

- `public/app.js`
  - 前端状态
  - 模型和人设选择
  - 讨论 job polling
  - 历史记录
  - AI 生图按钮

- `public/styles.css`
  - 响应式 UI
  - 聊天气泡
  - 四套场景样式

- `public/scenes/*.svg`
  - 四套场景背景图

- `docs/prompts.md`
  - 提示词设计说明

## 近期关键设计决定

### 1. 讨论要说人话

最近用户测试发现模型输出“熟悉又陌生”：文字多但概念密度太高，看起来像投研报告。

已在 `buildParticipantMessages` 和 `buildFinalMessages` 里加强：

- 说人话优先
- 每轮最多一个专业词
- 用专业词必须翻译成白话
- 禁止连续堆抽象名词
- 至少给一个具体例子、类比或动作
- 结论第二句要用“说白了”翻译

后续如果还觉得深奥，优先继续改提示词，而不是 UI。

### 2. AI 生图走 RunningHub

用户明确要 RunningHub AI 生图，不要只做本地 SVG 转 PNG。

当前前端按钮文案是：

```text
AI生图
```

点击后调用：

```text
POST /api/share-poster
```

服务端再调用 RunningHub。文件后缀可能还是 `.png`，但来源是 RunningHub 生图，不是本地排版截图。

### 3. “主公问策”只有一种模式

之前 UI 里出现一个不可选的“主公问策”下拉，用户问是不是只有一个。答案是：当前确实只有一个模式。

该控件已从 UI 删除。

### 4. 人设预设扩充

当前 `personaPresets` 里有 22 个，前 12 个更贴合议事：

- 军师
- 长史
- 逆耳谋士
- 裁断官
- 斥候
- 风控官
- 产品官
- 运营官
- 伦理顾问
- 数策师
- 史官
- 侦探

原来的乔布斯、鲁迅、怀疑者、家长视角、医生视角等也保留。

## 已知坑

1. MiMo V2.5 Pro 有时会 `finish_reason=length`，尤其是总结或长发言。代码已把“空正文但 length”当作截断重试，并提高 expanded 输出预算。

2. AIHubMix 额度可能耗尽，界面会显示模型暂时没接上。不要静默 mock。

3. MiMo Token Plan 的 Web Search 工具目前实测不通。不要因为控制台显示插件已开通就直接打开 `MIMO_ENABLE_WEB_SEARCH`。

4. RunningHub 生图消耗费用，测试时不要随便真实调用；可以用 `tests/runninghub.test.mjs` 的 mock 测接口逻辑。

5. NAS 上其他 Docker 很重要。部署只动 `/volume1/docker/3kingdom`，不要碰其他目录或容器。

## 清理策略

公开仓库应保留：

- 源码
- Docker 配置
- 自动化测试
- `README.md`
- `docs/HANDOFF.md`
- `docs/prompts.md`
- `public/scenes/*.svg`

不应提交：

- `.env.local`
- `.logs/`
- `.pids/`
- `.qa/`
- `ui-v2/`
- `tests/*.jpg`
- `tests/*.mhtml`
- `.DS_Store`
- 临时 tar 包

## 给下个 Codex 的建议

先运行：

```bash
pwd
node --test tests/*.test.mjs
```

如果要改提示词，先看：

```text
server/discussion.mjs
docs/prompts.md
```

如果用户说 NAS 版本有问题，先查：

```bash
curl http://192.168.3.71:5173/api/config
```

再通过 SSH 进入 NAS，只操作：

```text
/volume1/docker/3kingdom
```

不要动 NAS 其他文件。
