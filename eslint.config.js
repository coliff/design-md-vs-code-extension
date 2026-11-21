"use strict";

const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");
const globals = require("globals");

module.exports = [
  {
    ignores: [".vscode-test/**", "**/*.vsix", "node_modules/**", "out/**"],
  },
  js.configs.all,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "commonjs",
    },
    rules: {
      // Keep limits close to current code so growth stays intentional.
      complexity: ["error", 10],
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
      // Legitimate control-flow / Node patterns in this codebase.
      "no-magic-numbers": "off",
      "no-ternary": "off",
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
      "sort-keys": "off",
    },
  },
  {
    // Test suites are single long describe() callbacks.
    files: ["test/**/*.js"],
    rules: {
      "max-lines-per-function": "off",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "module",
    },
  },
  prettier,
];
