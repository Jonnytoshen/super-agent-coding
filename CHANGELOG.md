# Changelog

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
