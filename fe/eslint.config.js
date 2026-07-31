import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "coverage",
      "*.tsbuildinfo",
      "playwright-report",
      "test-results",
      "src/imports",
      "scripts",
    ],
  },

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        typescript: { project: "./tsconfig.app.json" },
        node: true,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "warn",
        {
          // Async event handlers (onClick, onChange, onSubmit, ...) and
          // react-router v7's navigate() returning a Promise are the dominant
          // sources of this rule firing. Both are intentional and harmless —
          // React fires the handler and ignores the returned promise. Turning
          // off the JSX-attribute check keeps the rule's value (catching real
          // bugs like passing async fn to Promise.all that expects sync) without
          // 60+ noise warnings on every onClick.
          checksVoidReturn: { attributes: false },
        },
      ],
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",

      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-key": ["error", { checkFragmentShorthand: true }],
      "react/no-array-index-key": "warn",
      "react/no-unstable-nested-components": "error",
      "react/jsx-no-leaked-render": ["error", { validStrategies: ["ternary"] }],
      "react/self-closing-comp": "error",

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-autofocus": "warn",

      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",

      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],

      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./src/shared", from: "./src/app" },
            { target: "./src/shared", from: "./src/features" },
            { target: "./src/features", from: "./src/app" },
          ],
        },
      ],
    },
  },

  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "App composition must import a feature's public index.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/features/admin/index.ts", "src/features/seller/index.ts"],
    rules: {
      "import/no-restricted-paths": "off",
    },
  },

  {
    files: [
      "src/features/admin-dashboard/**/*.{ts,tsx}",
      "src/features/admin-orders/**/*.{ts,tsx}",
      "src/features/admin-coupons/**/*.{ts,tsx}",
      "src/features/admin-users/**/*.{ts,tsx}",
      "src/features/admin-sellers/**/*.{ts,tsx}",
      "src/features/admin-reviews/**/*.{ts,tsx}",
      "src/features/admin-video/**/*.{ts,tsx}",
      "src/features/admin-disputes/**/*.{ts,tsx}",
      "src/features/admin-payouts/**/*.{ts,tsx}",
      "src/features/admin-payments/**/*.{ts,tsx}",
      "src/features/admin-health/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "react/no-unstable-nested-components": "off",
    },
  },

  {
    files: ["src/features/seller-products/**/*.ts", "src/features/seller-products/**/*.tsx"],
    rules: {
      "import/no-restricted-paths": "off",
    },
  },

  {
    files: ["**/*.config.{ts,js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: ["**/*.test.{ts,tsx}", "**/test-setup.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: false,
        project: "./tsconfig.test.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
  },

  {
    files: ["e2e/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: false,
        project: "./tsconfig.e2e.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  prettier,
);
