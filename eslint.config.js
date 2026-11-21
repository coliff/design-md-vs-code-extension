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
    // Shared by CommonJS sources and the ESM build script.
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
    },
    rules: {
      // Keep limits close to current code so growth stays intentional.
      complexity: ["error", 8],
      "func-style": ["error", "declaration", { allowArrowFunctions: true }],
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
      "max-depth": ["error", 3],
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
      // Colour channels, offsets and contrast thresholds read more clearly inline.
      "no-magic-numbers": "off",
      // Ternaries are idiomatic for the short value selections used here.
      "no-ternary": "off",
      // `undefined` is returned and passed deliberately for optional values.
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
      // `functions: false` allows mutually recursive helpers (renderValue/renderTable).
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
          array: true,
          object: true,
        },
      ],
      // Keys follow VS Code / DESIGN.md schema order, which is more meaningful than A-Z.
      "sort-keys": "off",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
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
      sourceType: "module",
    },
  },
  prettier,
];
