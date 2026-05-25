# 提交规范

项目采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范，并通过 `commitlint` + `husky` 在提交时进行自动校验。

## 推荐提交流程

使用 Commitizen 交互式提交（推荐）：

```bash
pnpm commit
```

也可手动提交：

```bash
git commit -m "feat(scope): your message"
```

## 提交格式

```text
<type>(<scope>): <subject>
```

常见 type：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `style`: 代码风格调整（不影响逻辑）
- `refactor`: 重构（不增加功能、不修复 Bug）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建、依赖、脚手架等杂项维护

## 自动校验机制

提交时会触发 `.husky/commit-msg`：

```bash
npx --no -- commitlint --edit "$1"
```

规则来源：

- `.commitlintrc.json` -> `@commitlint/config-conventional`

如果提交信息不符合规范，提交会被拦截。

## 常见问题

- `type` 不合法：请改为 `feat/fix/docs/chore` 等标准类型
- 信息过于笼统：建议补充 scope，例如 `feat(tools): add grep tool`
- 想临时跳过校验：可用 `--no-verify`，但不建议在常规开发中使用
