"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const vscode = require("vscode");
const css = require("./preview.css");
const { analyze } = require("./analyze");
const { getConfig } = require("./diagnostics");
const { buildPreviewHtml, relativeImagePath } = require("./preview-html");

const REFRESH_DELAY_MS = 200;
const VIEW_TYPE = "designMd.preview";

/**
 * The folder holding the document, or undefined for untitled files.
 * @param {vscode.Uri} uri
 * @returns {vscode.Uri | undefined}
 */
function documentFolder(uri) {
  return uri.scheme === "untitled" ? undefined : vscode.Uri.joinPath(uri, "..");
}

/**
 * Let the webview load local images from the document's folder and the
 * workspace folders, and run the preview's own nonce-locked script.
 * @param {vscode.Uri} uri
 * @returns {vscode.WebviewOptions}
 */
function webviewOptions(uri) {
  const folder = documentFolder(uri);
  const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map(
    (item) => item.uri,
  );
  return {
    enableScripts: true,
    localResourceRoots: folder
      ? [folder, ...workspaceFolders]
      : workspaceFolders,
  };
}

/**
 * Resolve relative image paths in the prose against the document's folder,
 * and paths starting with `/` against its workspace folder, like GitHub does.
 * @param {vscode.Uri} uri
 * @param {vscode.Webview} webview
 * @returns {(src: string) => string | undefined}
 */
function imageResolver(uri, webview) {
  const folder = documentFolder(uri);
  const root = vscode.workspace.getWorkspaceFolder(uri)?.uri ?? folder;
  return (src) => {
    const image = folder && relativeImagePath(src);
    if (!image) {
      return undefined;
    }
    const base = image.rootRelative ? root : folder;
    return webview
      .asWebviewUri(vscode.Uri.joinPath(base, image.path))
      .toString();
  };
}

/**
 * Manages one live preview panel per DESIGN.md document.
 */
class PreviewManager {
  constructor() {
    /** @type {Map<string, { panel: vscode.WebviewPanel, uri: vscode.Uri, timer?: NodeJS.Timeout }>} */
    this.previews = new Map();
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((event) => {
        // Saving fires a change event with no edits; skip the reload.
        if (event.contentChanges.length > 0) {
          this.scheduleRefresh(event.document);
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration("designMd.validate") ||
          event.affectsConfiguration("designMd.preview")
        ) {
          this.refreshAll();
        }
      }),
      vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, {
        deserializeWebviewPanel: (panel, state) => this.restore(panel, state),
      }),
    ];
  }

  /**
   * Re-render every open preview, e.g. after a settings change. Previews whose
   * editor tab is closed are re-rendered from the file.
   * @returns {Promise<void>}
   */
  async refreshAll() {
    await Promise.all(
      [...this.previews.values()].map(async ({ panel, uri }) => {
        try {
          const document = await vscode.workspace.openTextDocument(uri);
          if (this.previews.get(uri.toString())?.panel === panel) {
            this.render(document, panel);
          }
        } catch {
          // The file was deleted or moved; keep showing the last render.
        }
      }),
    );
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.ViewColumn} viewColumn
   */
  show(document, viewColumn) {
    const existing = this.previews.get(document.uri.toString());
    if (existing) {
      existing.panel.reveal(viewColumn, true);
      this.render(document, existing.panel);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      "",
      { preserveFocus: true, viewColumn },
      { enableFindWidget: true, ...webviewOptions(document.uri) },
    );
    this.track(document, panel);
  }

  /**
   * Restore a preview that was open before the window reloaded.
   * @param {vscode.WebviewPanel} panel
   * @param {{ uri?: string } | undefined} state
   * @returns {Promise<void>}
   */
  async restore(panel, state) {
    try {
      const uri = vscode.Uri.parse(state.uri, true);
      const document = await vscode.workspace.openTextDocument(uri);
      if (this.previews.has(uri.toString())) {
        panel.dispose();
        return;
      }
      panel.webview.options = webviewOptions(uri);
      this.track(document, panel);
    } catch {
      // No saved document, or it no longer exists.
      panel.dispose();
    }
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.WebviewPanel} panel
   */
  track(document, panel) {
    const key = document.uri.toString();
    const entry = { panel, uri: document.uri };
    this.previews.set(key, entry);
    panel.title = vscode.l10n.t(
      "Preview {0}",
      path.basename(document.fileName),
    );
    panel.onDidDispose(() => {
      clearTimeout(entry.timer);
      if (this.previews.get(key) === entry) {
        this.previews.delete(key);
      }
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
    const { contrastRatio, enable } = getConfig();
    const { problems, report } = analyze(text, { contrastRatio });
    panel.webview.html = buildPreviewHtml({
      contrastBadges: vscode.workspace
        .getConfiguration("designMd.preview")
        .get("contrastBadges", false),
      cspSource: panel.webview.cspSource,
      css,
      documentUri: document.uri.toString(),
      lang: vscode.env.language,
      nonce: crypto.randomBytes(16).toString("base64"),
      problems,
      report,
      resolveImage: imageResolver(document.uri, panel.webview),
      showLintResults: enable,
      text,
    });
  }

  dispose() {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    for (const { panel } of this.previews.values()) {
      panel.dispose();
    }
    this.previews.clear();
  }
}

module.exports = { PreviewManager };
