# Changelog

## [0.9.0](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.8.0...v0.9.0) (2026-08-21)

### Features

- **cli:** wire context defense into agent loop with quick commands ([3769ae6](https://github.com/Jonnytoshen/super-agent-coding/commit/3769ae668e6ff571434891ba96318ac68787569d))
- **context:** add three-layer context defense module ([c33be4d](https://github.com/Jonnytoshen/super-agent-coding/commit/c33be4d8b7bf35fab931e0a7b3db81429fb69cec))

## [0.8.0](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.7.0...v0.8.0) (2026-08-19)

### Features

- **context:** add context compaction with microcompact and summarization ([d63a958](https://github.com/Jonnytoshen/super-agent-coding/commit/d63a95800289c60cecbb2e787aab418c2ca8929d))

### Bug Fixes

- **context:** preserve existing summary when compaction is skipped ([c5fbb04](https://github.com/Jonnytoshen/super-agent-coding/commit/c5fbb04c6245fe616f1cabd641382fc28c66ec9b))

## [0.7.0](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.6.0...v0.7.0) (2026-08-17)

### Features

- **prompt:** introduce PromptBuilder pipe for system prompt assembly ([9ef8149](https://github.com/Jonnytoshen/super-agent-coding/commit/9ef8149ecea24448eea88ea4a8d421557c567d78))
- **session:** add session persistence and --continue flag ([09c6154](https://github.com/Jonnytoshen/super-agent-coding/commit/09c615471bde21eea4b07fcf67216f5177e3875a))

## [0.6.0](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.5.0...v0.6.0) (2026-06-01)

### Features

- **cli:** wire dynamic tool discovery into startup prompt and tool dashboard ([dbd64e9](https://github.com/Jonnytoshen/super-agent-coding/commit/dbd64e9b538481fd3573083f6a94be5d65707d47))
- **tools:** add active and deferred tool summary APIs ([1318000](https://github.com/Jonnytoshen/super-agent-coding/commit/131800054df53431a6cdc2fbc8c283813bb5414d))
- **tools:** add deferred metadata fields to tool definition ([85003f0](https://github.com/Jonnytoshen/super-agent-coding/commit/85003f05289c887f3919bd1dbe3c7115fd35a12f))
- **tools:** add discovered tool tracking in registry ([194dbe2](https://github.com/Jonnytoshen/super-agent-coding/commit/194dbe2de000467c3a9febe107e05cf45a974609))
- **tools:** add exact-name lookup API for deferred tools ([4fcafad](https://github.com/Jonnytoshen/super-agent-coding/commit/4fcafad2d0f44e9f281cc86970249cfce3a00b02))
- **tools:** add token estimate stats for tool schemas ([44dc1cc](https://github.com/Jonnytoshen/super-agent-coding/commit/44dc1cc8ea8ad674bc01d62e0204c387a1496d09))
- **tools:** add tool_search for deferred tool schema loading ([a945b3e](https://github.com/Jonnytoshen/super-agent-coding/commit/a945b3e783edfdf52d70e35d6c8b042ca75deac3))
- **tools:** mark MCP tools as deferred with search hints ([cc085f3](https://github.com/Jonnytoshen/super-agent-coding/commit/cc085f35f6ff4f095cd9d00ae22bc591e76b1fdd))

## [0.5.0](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.4.3...v0.5.0) (2026-05-29)

### Features

- **cli:** connect GitHub MCP server and refresh CLI output ([0fd68a7](https://github.com/Jonnytoshen/super-agent-coding/commit/0fd68a7ae74463dee511fa41519ec2a96675dab0))
- **config:** expose GitHub MCP token from env ([609f4c4](https://github.com/Jonnytoshen/super-agent-coding/commit/609f4c47a9485c2e5bb7cf6001211d370272a969))
- **readme:** update documentation to highlight GitHub MCP integration and workflow ([2ff8246](https://github.com/Jonnytoshen/super-agent-coding/commit/2ff8246c0a85ca5425b4ce77fb7da3d639145391))
- **tools:** add MCP stdio client ([7286018](https://github.com/Jonnytoshen/super-agent-coding/commit/728601886024e090dfc251548c8c48b65a1e7c6d))
- **tools:** register tools from MCP servers ([9a1a14f](https://github.com/Jonnytoshen/super-agent-coding/commit/9a1a14f362d79e5ea315f269000aa1e52d140cfe))

## [0.4.3](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.4.2...v0.4.3) (2026-05-27)

### Features

- **agent:** rewrite system prompt for web-search mode ([66aba51](https://github.com/Jonnytoshen/super-agent-coding/commit/66aba51634cb07d48b436a03bed3ec91b4c57afd))
- **config:** export TAVILY_API_KEY and SERPER_API_KEY from env ([02b050c](https://github.com/Jonnytoshen/super-agent-coding/commit/02b050cb41fe5a3c1b78328027e6ac8485395402))
- **readme:** update README to highlight Research Agent workflow and new tools ([e73d90c](https://github.com/Jonnytoshen/super-agent-coding/commit/e73d90c64fcfd5c6b843e18991a967d957c337c8))
- **tools:** add web_fetch markdown fetcher ([4059610](https://github.com/Jonnytoshen/super-agent-coding/commit/4059610be844d951c472f5996684d00b718a11ea))
- **tools:** add WebSearch tool with Tavily and Serper fallback ([04e2a42](https://github.com/Jonnytoshen/super-agent-coding/commit/04e2a429cadd002ddf94d9d7171ec4c4862d41f6))
- **tools:** migrate to factory-based tools ([0ec1d4e](https://github.com/Jonnytoshen/super-agent-coding/commit/0ec1d4e616b5ea03a45cceff34cc6eeeb47962f8))

### Bug Fixes

- **mock-model:** rename fetch_url → web_fetch and bump to v0.4.3 ([83e70a2](https://github.com/Jonnytoshen/super-agent-coding/commit/83e70a28d6dae8f3184b69f078e33dc52f6d0a58))

## [0.4.2](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.4.1...v0.4.2) (2026-05-26)

### Features

- **cli:** 更新 Mini Apps 引导提示与启动示例 ([3e8984a](https://github.com/Jonnytoshen/super-agent-coding/commit/3e8984ad078f5a03df37d2d682e381b2af26885e))
- **code-analysis:** 新增代码分析示例项目 ([6f4e547](https://github.com/Jonnytoshen/super-agent-coding/commit/6f4e54720a3561e3b42461ac129c025f815b9e53))
- **mock-model:** 新增代码分析、文档研究和 Vibe Coding cases ([d19fe18](https://github.com/Jonnytoshen/super-agent-coding/commit/d19fe18d8f64c7584d02b2d17ea06727afa75a5d))
- **tools:** 新增 fetch_url 网页抓取工具 ([4558b0e](https://github.com/Jonnytoshen/super-agent-coding/commit/4558b0ef0e29694e0c4c33dbe90e0dc77a5a0d7a))
- **tools:** 新增 start_preview 预览服务器工具 ([8aee7d1](https://github.com/Jonnytoshen/super-agent-coding/commit/8aee7d140d47a6ae45a3a63d723e66da6ca37224))
- **tools:** 注册 fetch_url 和 start_preview 工具 ([1abada4](https://github.com/Jonnytoshen/super-agent-coding/commit/1abada4693e0e0e5ddf743d26a177e955125d356))
- **vibe-coding:** 新增 Vibe Coding 预置脚手架 ([46dac69](https://github.com/Jonnytoshen/super-agent-coding/commit/46dac69e3f6142372ea2e3aacd26256ada62be28))

## [0.4.1](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.4.0...v0.4.1) (2026-05-25)

### Features

- add sample data file for test tools ([ad18fbb](https://github.com/Jonnytoshen/super-agent-coding/commit/ad18fbbe32c888ff9d05660e451f1338f16bdce7))
- **dependencies:** add fast-glob package for enhanced file operations ([69b40e1](https://github.com/Jonnytoshen/super-agent-coding/commit/69b40e151129ff996b2ef7da69320b7f8deb9fdf))
- **tools:** 新增 BashTool，支持执行 shell 命令 ([bd63b75](https://github.com/Jonnytoshen/super-agent-coding/commit/bd63b75f8240f5cac8f2dad1f9cd1537b3e77f28))
- **tools:** 新增 EditFileTool，支持文件精确局部替换 ([10be348](https://github.com/Jonnytoshen/super-agent-coding/commit/10be348e26e549aac9166fb6749104bdfbe7d85b))
- **tools:** 新增 GlobTool，支持 glob 模式文件搜索 ([fd6f9af](https://github.com/Jonnytoshen/super-agent-coding/commit/fd6f9af8c5e473f4ab97848056ed665cf21fcb69))
- **tools:** 新增 GrepTool，支持跨文件正则搜索 ([907bc43](https://github.com/Jonnytoshen/super-agent-coding/commit/907bc43484233f031b094ddae0f1f7954f8871f5))

## [0.4.0](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.3.0...v0.4.0) (2026-05-22)

### Features

- **mock-model:** 支持并发工具调用、文件工具意图检测、简化 usage 常量 ([e54d0fb](https://github.com/Jonnytoshen/super-agent-coding/commit/e54d0fbffa49628d6405d1d55f65affa463ec9cb))
- **tool-registry:** implement ToolRegistry and truncateResult function for tool management ([04d9a37](https://github.com/Jonnytoshen/super-agent-coding/commit/04d9a37b740923fa278127c779c84be984d7d397))
- **tool-registry:** 为 ToolRegistry 引入读写锁，保障工具并发安全 ([8256d39](https://github.com/Jonnytoshen/super-agent-coding/commit/8256d39251707c86c3022fe371aa997eaf189f33))
- **tools:** 新增文件操作工具及 ToolDefinition 统一定义 ([d4e5561](https://github.com/Jonnytoshen/super-agent-coding/commit/d4e55619c0ed0119aac12e47990c7e912e564553))

## [0.3.0](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.2.0...v0.3.0) (2026-05-21)

### Features

- add @ai-sdk/provider dependency ([c9c63c2](https://github.com/Jonnytoshen/super-agent-coding/commit/c9c63c21c65fed48f96d75690117de6f9b140ad8))
- add mock model implementation with tool calling and loop testing support ([b0e0d39](https://github.com/Jonnytoshen/super-agent-coding/commit/b0e0d3916b4ffce292b14b457bbd45fb175c2c16))
- add three-layer agent loop protection ([861f9d2](https://github.com/Jonnytoshen/super-agent-coding/commit/861f9d282d4be28eef426e71109d294d93c42868))
- **types:** add SafeAny type and index export ([233cada](https://github.com/Jonnytoshen/super-agent-coding/commit/233cada41c358b6a1dea94fafeb8f6896f77af76))

## [0.2.0](https://github.com/Jonnytoshen/super-agent-coding/compare/v0.1.0...v0.2.0) (2026-05-19)

### Features

- **agent:** implement multi-step agent loop ([e7aea8d](https://github.com/Jonnytoshen/super-agent-coding/commit/e7aea8d0b2ac04959ad0aec819cdc947fb721d75))
- **tools:** add WeatherTool and CalculatorTool ([cf4efa0](https://github.com/Jonnytoshen/super-agent-coding/commit/cf4efa033a8cd9d2137d25afd0e797cd5510e73a))
- wire agent loop and tools into CLI entry ([df61fed](https://github.com/Jonnytoshen/super-agent-coding/commit/df61fed3a06cb16aab2dcd12276b36475d2919a3))

### Bug Fixes

- **tsconfig:** enable skipLibCheck to allow JSON module import ([fc29796](https://github.com/Jonnytoshen/super-agent-coding/commit/fc29796f2ae4b7155891eb8ff9b49e2bcacd1711))

## 0.1.0 (2026-05-19)

### Features

- add interactive CLI chat agent with Qwen model ([b07249f](https://github.com/Jonnytoshen/super-agent-coding/commit/b07249fe3c6440a3f8b62354e6db17916b20af7a))

### Bug Fixes

- **release:** delegate auto-bump to conventional-changelog plugin ([5e50c39](https://github.com/Jonnytoshen/super-agent-coding/commit/5e50c39aea3802571daa6d8e66fc08b4095ee040))
- **release:** use --no-increment for first release and guard same-version bump ([277ebe5](https://github.com/Jonnytoshen/super-agent-coding/commit/277ebe52bf406f116538ce271edfce2ba05284b7))
