# 发布流程

本项目使用自定义脚本 `scripts/release.mjs` 驱动 `release-it` 与 Conventional Changelog。

## 发布前检查

- 确保工作区干净（无未提交更改）
- 确保最近提交符合 Conventional Commits（影响自动版本推导）

## 常用命令

| 命令                           | 场景                                           |
| ------------------------------ | ---------------------------------------------- |
| `pnpm release:first`           | 首次发布（使用当前 package.json 版本，不递增） |
| `pnpm release --version 1.2.3` | 指定版本发布                                   |
| `pnpm release`                 | 根据提交记录自动推导版本（推荐日常使用）       |
| `pnpm release:dry`             | Dry Run 预览                                   |

## 版本推导规则（自动模式）

- `fix:` -> patch
- `feat:` -> minor
- `BREAKING CHANGE` -> major

## 首次发布

首次发布时不会 bump 版本号，而是直接使用 `package.json` 当前版本：

```bash
pnpm release:first
# 等价于
pnpm release --first-release
```

## 指定版本发布

```bash
pnpm release --version 1.2.3
```

注意：

- 版本号必须是 `MAJOR.MINOR.PATCH` 形式
- 不能与当前 `package.json` 版本相同
- `--first-release` 与 `--version` 不能同时使用

## Dry Run（预览）

预览发布流程，不写入文件：

```bash
pnpm release --dry-run
pnpm release --first-release --dry-run
pnpm release --version 1.2.3 --dry-run
```

## 发布后会做什么

发布命令执行成功后会自动完成：

1. 更新 `package.json` 版本
2. 更新 `CHANGELOG.md`
3. 创建发布提交（`chore(release): vX.Y.Z`）
4. 创建 tag（`vX.Y.Z`）

## 关于推送

当前 `.release-it.json` 配置为 `"git.push": false`，因此发布后不会自动推送远端。

如需推送，请手动执行：

```bash
git push origin <branch> --follow-tags
```
