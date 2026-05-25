# 代码规范与质量检查

本项目使用以下质量工具：

- ESLint v9 Flat Config
- typescript-eslint（类型感知规则）
- Prettier
- lint-staged + Husky

## 常用命令

| 命令                | 说明                         |
| ------------------- | ---------------------------- |
| `pnpm lint`         | 全量检查代码问题             |
| `pnpm lint:fix`     | 自动修复可修复问题           |
| `pnpm lint:cache`   | 使用缓存进行增量检查         |
| `pnpm format:check` | 仅检查格式，不改文件         |
| `pnpm preflight`    | 一次执行 lint + format:check |

## 提交前自动检查

`.husky/pre-commit` 会执行：

```bash
pnpm lint-staged
```

`lint-staged` 规则（来自 `package.json`）：

- `src/**/*.{ts,tsx}` -> `eslint --fix` + `prettier --write`
- `scripts/**/*.{js,mjs}` -> `eslint --fix` + `prettier --write`
- `**/*.{json,md}` -> `prettier --write`

这意味着：提交时只检查暂存区文件，速度更快，也更利于小步提交。

## 建议工作流

1. 开发过程中使用 `pnpm lint:cache` 快速反馈
2. 提交前运行 `pnpm preflight` 做全量校验
3. 通过 `pnpm commit` 提交并让 Hook 做最终兜底

## 说明

如果需要紧急提交，可使用 `git commit --no-verify` 跳过钩子，但建议事后尽快补上质量检查。
