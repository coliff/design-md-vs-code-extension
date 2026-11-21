"use strict";

const vscode = require("vscode");
const { registerCommands } = require("./commands");
const { registerDiagnostics } = require("./diagnostics");
const { registerLanguageFeatures } = require("./language");
const { createMarkdownItPlugin } = require("./markdown-it-plugin");
const { PreviewManager } = require("./preview");

function getFrontMatterMode(uri) {
  return vscode.workspace
    .getConfiguration("markdown", uri ?? null)
    .get("preview.frontMatter", "table");
}

/**
 * @param {import("vscode").ExtensionContext} context
 */
function activate(context) {
  const diagnostics = registerDiagnostics(context);
  const preview = new PreviewManager();
  context.subscriptions.push(preview);
  registerLanguageFeatures(context);
  registerCommands(context, { diagnostics, preview });
  return { extendMarkdownIt: createMarkdownItPlugin(getFrontMatterMode) };
}

function deactivate() {
  // Disposables are cleaned up through context.subscriptions.
}

module.exports = { activate, deactivate };
