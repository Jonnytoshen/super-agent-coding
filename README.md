# Super Agent Coding

Step-by-step hands-on training in AI agent development.

## 提交规范

项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范，提交时建议通过交互式命令：

```bash
pnpm commit
```

提交格式：

```
<type>(<scope>): <subject>

feat     新功能
fix      Bug 修复
docs     文档变更
style    代码格式（不影响逻辑）
refactor 重构
perf     性能优化
test     测试
chore    构建或辅助工具变更
```

`commit-msg` husky 钩子会自动校验提交消息格式，不符合规范的提交会被拦截。

## 发布流程

> 发布前请确保工作区干净（无未提交更改）。

### 首次发布

使用 `package.json` 中的 `version` 作为发布版本号，并生成初始 CHANGELOG：

```bash
pnpm release:first
# 等价于
pnpm release --first-release
```

### 指定版本发布

```bash
pnpm release --version 1.2.3
```

### 自动判断版本（推荐日常使用）

根据提交记录自动推导 major / minor / patch：

- `fix:` → patch（1.0.0 → 1.0.1）
- `feat:` → minor（1.0.0 → 1.1.0）
- `BREAKING CHANGE` → major（1.0.0 → 2.0.0）

```bash
pnpm release
```

### Dry Run（预览，不写入）

在任意发布命令后追加 `--dry-run`：

```bash
pnpm release --dry-run
pnpm release --first-release --dry-run
pnpm release --version 1.2.3 --dry-run
# 或使用便捷脚本
pnpm release:dry
```

发布命令执行后会自动完成：

1. 更新 `package.json` 中的版本号
2. 生成 / 追加 `CHANGELOG.md`
3. 创建 release commit（`chore(release): vX.Y.Z`）
4. 打 git tag（`vX.Y.Z`）