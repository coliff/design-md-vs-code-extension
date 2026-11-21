"use strict";

const comments = require("@eslint-community/eslint-plugin-eslint-comments/configs");
const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");
const nodePlugin = require("eslint-plugin-n");
const promise = require("eslint-plugin-promise");
const regexp = require("eslint-plugin-regexp");
const { default: unicorn } = require("eslint-plugin-unicorn");
const globals = require("globals");

module.exports = [
  {
    ignores: [".vscode-test/**", "**/*.vsix", "node_modules/**", "out/**"],
  },
  js.configs.all,
  unicorn.configs.recommended,
  nodePlugin.configs["flat/recommended"],
  regexp.configs["flat/recommended"],
  promise.configs["flat/recommended"],
  comments.recommended,
  {
    settings: {
      // Matches the Node.js runtime bundled with the minimum supported VS Code.
      node: { version: ">=22.0.0" },
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
    },
    rules: {
      // Every inline disable must say why it is needed.
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "@eslint-community/eslint-comments/require-description": "error",
      // Keep limits close to current code so growth stays intentional.
      complexity: ["error", 10],
      // Function declarations and expressions are both used deliberately.
      "func-style": "off",
      "id-length": [
        "error",
        {
          exceptions: ["x", "y"],
        },
      ],
      "max-lines": [
        "error",
        {
          max: 250,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      "max-lines-per-function": [
        "error",
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      "max-nested-callbacks": ["error", 3],
      "max-params": ["error", 3],
      "max-statements": ["error", 20],
      // `vscode` is provided by the extension host at runtime, not node_modules.
      "n/no-missing-import": ["error", { allowModules: ["vscode"] }],
      "n/no-missing-require": ["error", { allowModules: ["vscode"] }],
      // Line/column offsets, colour channels and contrast thresholds are clearer inline.
      "no-magic-numbers": "off",
      // Ternaries are idiomatic for the short value selections used here.
      "no-ternary": "off",
      // `undefined` is used intentionally for optional VS Code API arguments.
      "no-undefined": "off",
      "no-underscore-dangle": [
        "error",
        {
          allow: ["_compile", "_extensions"],
        },
      ],
      "no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          reportUsedIgnorePattern: true,
          varsIgnorePattern: "^_",
        },
      ],
      "no-use-before-define": [
        "error",
        {
          classes: false,
          functions: false,
          variables: true,
        },
      ],
      "one-var": ["error", "never"],
      "prefer-destructuring": [
        "error",
        {
          array: false,
          object: true,
        },
      ],
      // Conventional JSDoc (` * ` prefixes, one-line `/** @type {…} */` casts) is what editors and tsc expect.
      "unicorn/no-asterisk-prefix-in-documentation-comments": "off",
      "unicorn/single-line-block-comment-style": "off",
      // Conflicts with core `consistent-return`, which wants an explicit `return undefined`.
      "unicorn/no-useless-undefined": "off",
      // Conflicts with core `no-continue`, which this config keeps enabled.
      "unicorn/prefer-continue": "off",
      // Keys follow the VS Code / DESIGN.md schema order, which is more meaningful than A-Z.
      "sort-keys": "off",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
    rules: {
      // The extension is bundled to CommonJS for the VS Code extension host.
      "unicorn/prefer-module": "off",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    files: ["test/**/*.js"],
    rules: {
      // Test suites are single long describe() callbacks.
      "max-lines-per-function": "off",
    },
  },
  prettier,
];
