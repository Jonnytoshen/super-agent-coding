# Super Agent Coding

Step-by-step hands-on training in AI agent development.

这是一个用于学习和演示 Agent Loop 的 TypeScript CLI 项目，核心聚焦在：

- 工具调用（Tool Calling）
- 多步推理循环（Agent Loop）
- 稳定性防护（循环检测、重试、Token 预算）

## 核心能力

- 交互式命令行 Agent，支持持续对话
- 9 个内置工具（文件、搜索、Shell、计算、天气）
- 支持并发工具调用，ToolRegistry 内置读写锁调度
- 三层防护机制：循环检测、API 重试、Token 预算控制
- 无 API Key 时自动切换 Mock 模型，便于本地演练

## 项目结构

```text
.
├── scripts/
│   └── release.mjs               # 自定义发布脚本
├── src/
│   ├── index.ts                  # CLI 入口
│   ├── agent-loop.ts             # Agent 主循环
│   ├── loop-detection.ts         # 循环检测
│   ├── retry.ts                  # 重试策略
│   ├── mock-model.ts             # 本地 Mock 模型
│   └── tools/                    # 工具系统与内置工具
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

- 配置 `DASHSCOPE_API_KEY` 后使用 Qwen 模型
- 不配置时自动使用 `src/mock-model.ts`（适合本地测试）

### 4) 启动

```bash
pnpm start
```

开发模式（监听变更）：

```bash
pnpm dev
```

## 示例指令

启动后可直接输入：

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
| `get_weather`    | 查询城市天气（Mock 数据） | 是       | 是   |
| `calculator`     | 计算数学表达式            | 是       | 是   |
| `read_file`      | 读取文件内容              | 是       | 是   |
| `list_directory` | 列目录内容                | 是       | 是   |
| `glob`           | 按模式搜索文件            | 是       | 是   |
| `grep`           | 跨文件正则搜索            | 是       | 是   |
| `write_file`     | 写入文件                  | 否       | 否   |
| `edit_file`      | 精确替换文件片段          | 否       | 否   |
| `bash`           | 执行 Shell 命令           | 否       | 否   |

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
