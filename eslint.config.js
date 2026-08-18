import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import pluginSecurity from "eslint-plugin-security";
import pluginNoSecrets from "eslint-plugin-no-secrets";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "apps/web/**",
      "services/tivs-acl/**",
      "lambda/**",
      "artifacts/**"
    ]
  },
  pluginSecurity.configs.recommended,
  {
    files: ["src/typescript/**/*.ts", "tests/**/*.ts", "apps/api/src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        project: "./tsconfig.eslint.json",
        sourceType: "module",
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "no-secrets": pluginNoSecrets
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
      "no-secrets/no-secrets": [
        "error",
        {
          "ignoreContent": [
            "cloudfront\\.localhost\\.localstack\\.cloud",
            "argon2id",
            "0123456789abcdef"
          ]
        }
      ]
    }
  }
];
