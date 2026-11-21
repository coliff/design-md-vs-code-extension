"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const vscode = require("vscode");
const css = require("./preview.css");
const { analyze } = require("./analyze");
const { buildPreviewHtml } = require("./preview-html");

const REFRESH_DELAY_MS = 200;

/**
 * Manages one live preview panel per DESIGN.md document.
 */
class PreviewManager {
  constructor() {
    /** @type {Map<string, { panel: vscode.WebviewPanel, timer?: NodeJS.Timeout }>} */
    this.previews = new Map();
    this.subscription = vscode.workspace.onDidChangeTextDocument((event) =>
      this.scheduleRefresh(event.document),
    );
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.ViewColumn} viewColumn
   */
  show(document, viewColumn) {
    const key = document.uri.toString();
    const existing = this.previews.get(key);
    if (existing) {
      existing.panel.reveal(viewColumn, true);
      this.render(document, existing.panel);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "designMd.preview",
      vscode.l10n.t("Preview {0}", path.basename(document.fileName)),
      { preserveFocus: true, viewColumn },
      { enableFindWidget: true, enableScripts: false, localResourceRoots: [] },
    );
    const entry = { panel };
    this.previews.set(key, entry);
    panel.onDidDispose(() => {
      clearTimeout(entry.timer);
      this.previews.delete(key);
    });
    this.render(document, panel);
  }

  /**
   * @param {vscode.TextDocument} document
   */
  scheduleRefresh(document) {
    const entry = this.previews.get(document.uri.toString());
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    entry.timer = setTimeout(
      () => this.render(document, entry.panel),
      REFRESH_DELAY_MS,
    );
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.WebviewPanel} panel
   */
  // eslint-disable-next-line class-methods-use-this
  render(document, panel) {
    const text = document.getText();
    const { report } = analyze(text);
    panel.webview.html = buildPreviewHtml({
      cspSource: panel.webview.cspSource,
      css,
      nonce: crypto.randomBytes(16).toString("base64"),
      report,
      text,
    });
  }

  dispose() {
    this.subscription.dispose();
    for (const { panel } of this.previews.values()) {
      panel.dispose();
    }
    this.previews.clear();
  }
}

module.exports = { PreviewManager };
