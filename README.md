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

## 代码规范与 Lint

项目使用 [ESLint v9 Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files) + `typescript-eslint`（带类型感知规则），并与 Prettier 共存（互不冲突）。

### 常用命令

| 命令                | 说明                             |
| ------------------- | -------------------------------- |
| `pnpm lint`         | 检查所有文件，列出问题           |
| `pnpm lint:fix`     | 检查并自动修复可修复问题         |
| `pnpm lint:cache`   | 增量检查（利用缓存，速度更快）   |
| `pnpm format:check` | 仅验证 Prettier 格式，不修改文件 |

### 提交前自动检查

提交时 Husky `pre-commit` 钩子会自动运行 `lint-staged`，只处理暂存的文件：

- `src/**/*.{ts,tsx}` → `eslint --fix` + `prettier --write`
- `scripts/**/*.{js,mjs}` → `eslint --fix` + `prettier --write`
- `**/*.{json,md}` → `prettier --write`

如需临时跳过（**不推荐**）：

```bash
git commit --no-verify -m "chore: ..."
```

### Hono 路由规则说明

`eslint.config.mjs` 中已预留 Hono 路由目录专属规则注释区。当 `src/routes` 或 `src/app` 路由文件引入后，可在该区域直接追加约束（无需重构整体配置结构）。

---

## 发布流程

> 发布前请确保工作区干净（无未提交更改）。

### 首次发布

使用 `package.json` 中的 `version` 作为发布版本号，生成初始 CHANGELOG，**不递增版本号**。
适用于仓库尚无任何 git tag 的第一次正式发布。

```bash
pnpm release:first
# 等价于
pnpm release --first-release
```

### 指定版本发布

> **注意**：指定版本号必须高于当前 `package.json` 中的版本，否则会报错并提示改用 `--first-release`。

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
