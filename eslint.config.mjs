// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // ── 全局忽略 ────────────────────────────────────────────────────────────────
  {
    ignores: ['dist/**', 'node_modules/**', '*.lock', 'CHANGELOG.md'],
  },

  // ── JS 推荐规则基线（全局） ──────────────────────────────────────────────────
  eslint.configs.recommended,

  // ── TypeScript 源文件：带类型感知的推荐规则（仅限 src/**/*.ts） ─────────────
  {
    files: ['src/**/*.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 与 Prettier singleQuote / trailingComma 对齐的非格式化规则
      'prefer-const': 'error',
      'no-var': 'error',

      // TypeScript 严格补充
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // ── Hono 预留区 ──────────────────────────────────────────────────────────
      // 当 src/routes 或 src/app 路由文件引入后，可在此补充：
      //   - no-restricted-imports: 禁止直接从 hono/dist 导入内部路径
      //   - @typescript-eslint/explicit-function-return-type: 路由处理函数须标注返回类型
      //   - @typescript-eslint/no-misused-promises: 禁止将 async 路由直接传给非 Promise 感知 API
    },
  },

  // ── scripts/ 目录（MJS 脚本，关闭类型感知规则） ────────────────────────────
  {
    files: ['scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ── Prettier 兼容（必须放最后，覆盖所有格式化相关规则） ─────────────────────
  prettierConfig,
);
