# Super Agent Coding

Step-by-step hands-on training in AI agent development.

这是一个用于学习和演示 Agent Loop 的 TypeScript CLI 项目，核心聚焦在：

- 工具调用（Tool Calling）
- 多步推理循环（Agent Loop）
- 稳定性防护（循环检测、重试、Token 预算）

当前版本重点演示一个同时支持内置工具和 GitHub MCP 工具的 Agent 工作流：

- 12 个内置工具：本地文件、代码搜索、Shell、网页搜索、网页抓取、预览等
- GitHub MCP Server：启动时按需注册 `mcp__github__*` 工具
- 单个 Agent 同时处理本地代码操作、联网检索和 GitHub 信息查询

- `web_search`：搜索互联网，返回标题、链接和摘要
- `web_fetch`：抓取指定 URL 的网页内容并转换成 Markdown
- `mcp__github__*`：查询 GitHub 仓库、Issue、搜索等信息

## 核心能力

- 交互式命令行 Agent，支持持续对话
- 12 个内置工具（文件、搜索、Shell、计算、天气、网页搜索、网页抓取、预览）
- 支持在启动时通过 MCP 动态注册 GitHub 工具，统一纳入同一个 ToolRegistry
- 支持基于 Tavily / Serper 的最新信息检索，再用 `web_fetch` 深挖具体页面
- 支持使用 GitHub MCP 工具查询仓库、Issue 等 GitHub 数据
- 支持并发工具调用，ToolRegistry 内置读写锁调度
- 支持通过 `npx` 启动 MCP Server，并在退出时自动关闭连接
- 保留本地文件读写、代码搜索和 `app/` 预览能力，便于继续做 Agent 实验
- 三层防护机制：循环检测、API 重试、Token 预算控制
- 无 API Key 时自动切换 Mock 模型，便于本地演练

## 项目结构

```text
.
├── app/
│   └── index.html               # 本地预览入口
├── docs/
│   └── development/             # 开发规范、提交规范、发布流程
├── sample-project/              # 供本地搜索 / 读写工具演练的示例项目
├── scripts/
│   └── release.mjs               # 自定义发布脚本
├── src/
│   ├── index.ts                  # CLI 入口
│   ├── agent-loop.ts             # Agent 主循环
│   ├── loop-detection.ts         # 循环检测
│   ├── retry.ts                  # 重试策略
│   ├── mock-model.ts             # 本地 Mock 模型
│   └── tools/                    # 工具系统、MCP 客户端与内置工具
├── sample-data.txt               # 测试文件（用于工具演示）
└── CHANGELOG.md
```

## 快速开始

### 1) 环境要求

- Node.js 20+
- pnpm 10+

### 2) 安装依赖

```bash
pnpm install
```

### 3) 配置环境变量（可选）

```bash
cp .env.example .env
```

- `DASHSCOPE_API_KEY`：配置后使用 Qwen 模型；不配置时自动回退到 `src/mock-model.ts`
- `TAVILY_API_KEY`：启用 Tavily 搜索，`web_search` 会优先使用它
- `SERPER_API_KEY`：如果没有 Tavily，也可以配置 Serper 作为 `web_search` 的后备搜索源
- `GITHUB_PERSONAL_ACCESS_TOKEN`：配置后会在启动时通过 `npx -y @modelcontextprotocol/server-github` 连接 GitHub MCP Server
- 如果两个搜索 API Key 都没有配置，`web_search` 会提示先补充环境变量；其他本地工具仍可使用
- 如果没有配置 `GITHUB_PERSONAL_ACCESS_TOKEN`，或者当前环境不允许拉起子进程，CLI 会跳过 GitHub MCP，仅保留内置工具

### 4) 启动

```bash
pnpm start
```

开发模式（监听变更）：

```bash
pnpm dev
```

启动后可直接在 CLI 中输入自然语言指令，Agent 会自动决定是否调用工具。

## 示例指令

启动后可直接输入：

- 查看 vercel/ai 的 issues
- 搜索 MCP 相关的仓库
- 搜索一下 Vercel AI SDK 最新版本
- 2026 年最流行的 Agent 框架是什么？
- 帮我查一下 TypeScript 5.8 有什么新特性？
- 看一下 https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling 并总结重点
- 找出 sample-project 里所有 TODO / FIXME
- 测试编辑
- 测试glob
- 测试搜索
- 测试bash
- 测试并发
- 测试重试
- 测试死循环

## 内置工具一览

| 工具名           | 作用                      | 并发安全 | 只读 |
| ---------------- | ------------------------- | -------- | ---- |
| `web_search`     | 搜索互联网最新信息        | 是       | 是   |
| `web_fetch`      | 抓取网页并转为 Markdown   | 是       | 是   |
| `get_weather`    | 查询城市天气（Mock 数据） | 是       | 是   |
| `calculator`     | 计算数学表达式            | 是       | 是   |
| `read_file`      | 读取文件内容              | 是       | 是   |
| `list_directory` | 列目录内容                | 是       | 是   |
| `glob`           | 按模式搜索文件            | 是       | 是   |
| `grep`           | 跨文件正则搜索            | 是       | 是   |
| `write_file`     | 写入文件                  | 否       | 否   |
| `edit_file`      | 精确替换文件片段          | 否       | 否   |
| `start_preview`  | 启动 `app/` 预览服务器    | 否       | 否   |
| `bash`           | 执行 Shell 命令           | 否       | 否   |

> 说明：如果配置了 `GITHUB_PERSONAL_ACCESS_TOKEN`，启动后还会额外注册一组以 `mcp__github__` 开头的 GitHub MCP 工具。具体数量取决于 MCP Server 暴露的能力，CLI 启动时会以表格形式打印出来。

## GitHub MCP 工作流

- CLI 启动时会先尝试连接 GitHub MCP Server，成功后把远程工具注册为 `mcp__github__*`
- Agent 在查询 GitHub 相关信息时，优先使用这些 MCP 工具，而不是把 GitHub 当普通网页抓取
- 当前接入方式默认把 GitHub MCP 工具视为只读、可并发调用，便于做仓库搜索、Issue 查询等只读场景
- 退出 CLI 时会自动关闭 MCP 子进程，避免残留连接

## 联网搜索说明

- `web_search` 优先走 Tavily；如果未配置 Tavily，则自动退回到 Serper
- 建议先让 Agent 用 `web_search` 找到候选来源，再按需用 `web_fetch` 抓取全文
- `web_fetch` 适合公开可访问的 HTTP(S) 页面，会把 HTML 内容转成更适合总结的 Markdown
- GitHub 相关问题优先走 `mcp__github__*`；通用公开网页检索再使用 `web_search` / `web_fetch`

## 本地预览说明

- `start_preview` 会启动 `app/` 目录下的本地预览服务器，默认地址是 `http://localhost:8080`
- 如果你要继续做前端 demo，可以直接复用现有 `app/index.html`

## 常用脚本

| 命令                | 说明                        |
| ------------------- | --------------------------- |
| `pnpm start`        | 启动 CLI Agent              |
| `pnpm dev`          | 监听模式启动                |
| `pnpm lint`         | 执行 ESLint 检查            |
| `pnpm lint:fix`     | 自动修复可修复问题          |
| `pnpm format:check` | 校验 Prettier 格式          |
| `pnpm preflight`    | 提交前检查（lint + format） |

## 开发文档

README 仅保留项目使用与能力概览，开发流程拆分到独立文档：

- [提交规范](docs/development/commit-convention.md)
- [代码规范与质量检查](docs/development/code-style-and-quality.md)
- [发布流程](docs/development/release-process.md)

## 版本记录

- 详见 [CHANGELOG.md](CHANGELOG.md)

## License

ISC
