"use strict";

const { registerCommands } = require("./commands");
const { registerDiagnostics } = require("./diagnostics");
const { registerLanguageFeatures } = require("./language");
const { PreviewManager } = require("./preview");

/**
 * @param {import("vscode").ExtensionContext} context
 */
function activate(context) {
  const diagnostics = registerDiagnostics(context);
  const preview = new PreviewManager();
  context.subscriptions.push(preview);
  registerLanguageFeatures(context);
  registerCommands(context, { diagnostics, preview });
}

function deactivate() {
  // Disposables are cleaned up through context.subscriptions.
}

module.exports = { activate, deactivate };
