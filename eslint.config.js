import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.vite/**",
      "**/coverage/**",
      "contracts/out/**",
      "contracts/cache/**",
      "contracts/lib/**",
      "server/drizzle/migrations/**",
      "Mantua Prototype.html",
      "/src/**",
      "/landing/**",
      "/assets/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["client/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        project: ["./client/tsconfig.app.json", "./client/tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["server/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: {
        project: ["./server/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Files outside the client/server tsconfig projects (one-off Node
  // scripts and root-level config files). Keep syntactic rules but
  // disable type-aware ones so we don't have to maintain a dedicated
  // tsconfig project for them.
  {
    files: ["contracts/script/**/*.ts", "eslint.config.js", "*.config.{js,cjs,mjs,ts}"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
  },
);
