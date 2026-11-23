"use strict";

const vscode = require("vscode");
const { analyze, isDesignDocument } = require("./analyze");

const SEVERITY = {
  error: vscode.DiagnosticSeverity.Error,
  info: vscode.DiagnosticSeverity.Information,
  warning: vscode.DiagnosticSeverity.Warning,
};

function getConfig() {
  const config = vscode.workspace.getConfiguration("designMd.validate");
  return {
    debounceMs: config.get("debounceMs", 300),
    enable: config.get("enable", true),
  };
}

/**
 * Convert located problems into VS Code diagnostics for a document.
 * @param {vscode.TextDocument} document
 * @returns {vscode.Diagnostic[]}
 */
function toDiagnostics(document) {
  const { problems } = analyze(document.getText());
  return problems.map((problem) => {
    const range = new vscode.Range(
      document.positionAt(problem.start),
      document.positionAt(problem.end),
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      problem.message,
      SEVERITY[problem.severity],
    );
    diagnostic.source = "DESIGN.md";
    if (problem.rule) {
      diagnostic.code = problem.rule;
    }
    return diagnostic;
  });
}

/**
 * Register on-open and on-change validation of DESIGN.md files.
 * @param {vscode.ExtensionContext} context
 * @returns {{ validate: (document: vscode.TextDocument) => void }}
 */
function registerDiagnostics(context) {
  const collection = vscode.languages.createDiagnosticCollection("design-md");
  const timers = new Map();

  function validate(document) {
    if (!isDesignDocument(document)) {
      return;
    }
    if (!getConfig().enable) {
      collection.delete(document.uri);
      return;
    }
    collection.set(document.uri, toDiagnostics(document));
  }

  function schedule(document) {
    if (!isDesignDocument(document)) {
      return;
    }
    const key = document.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        validate(document);
      }, getConfig().debounceMs),
    );
  }

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(validate),
    vscode.workspace.onDidChangeTextDocument((event) =>
      schedule(event.document),
    ),
    vscode.workspace.onDidCloseTextDocument((document) => {
      // A pending debounced run would otherwise re-add diagnostics after close.
      const key = document.uri.toString();
      clearTimeout(timers.get(key));
      timers.delete(key);
      collection.delete(document.uri);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("designMd.validate")) {
        vscode.workspace.textDocuments.forEach(validate);
      }
    }),
    { dispose: () => timers.forEach((timer) => clearTimeout(timer)) },
  );

  vscode.workspace.textDocuments.forEach(validate);

  return { validate };
}

module.exports = { registerDiagnostics };
