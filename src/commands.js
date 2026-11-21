"use strict";

const vscode = require("vscode");
const template = require("./template.md");
const { fixSectionOrderText, isDesignDocument } = require("./analyze");

/**
 * Resolve the DESIGN.md document a command should act on.
 * @param {vscode.Uri | undefined} uri
 * @returns {Promise<vscode.TextDocument | undefined>}
 */
async function resolveDocument(uri) {
  const document = uri
    ? await vscode.workspace.openTextDocument(uri)
    : vscode.window.activeTextEditor?.document;
  if (!document || !isDesignDocument(document)) {
    vscode.window.showWarningMessage(
      vscode.l10n.t("Open a DESIGN.md file first."),
    );
    return undefined;
  }
  return document;
}

async function createDesignFile() {
  const [folder] = vscode.workspace.workspaceFolders ?? [];
  if (!folder) {
    const document = await vscode.workspace.openTextDocument({
      content: template,
      language: "markdown",
    });
    await vscode.window.showTextDocument(document);
    return;
  }
  const target = vscode.Uri.joinPath(folder.uri, "DESIGN.md");
  try {
    await vscode.workspace.fs.stat(target);
    vscode.window.showInformationMessage(
      vscode.l10n.t("DESIGN.md already exists."),
    );
  } catch {
    await vscode.workspace.fs.writeFile(
      target,
      new TextEncoder().encode(template),
    );
  }
  await vscode.window.showTextDocument(target);
}

async function fixSectionOrderCommand(uri) {
  const document = await resolveDocument(uri);
  if (!document) {
    return;
  }
  const fixed = fixSectionOrderText(document.getText());
  if (fixed === undefined) {
    vscode.window.showInformationMessage(
      vscode.l10n.t("Sections are already in order."),
    );
    return;
  }
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length),
  );
  edit.replace(document.uri, fullRange, fixed);
  await vscode.workspace.applyEdit(edit);
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {object} services
 * @param {{ validate: (document: vscode.TextDocument) => void }} services.diagnostics
 * @param {import("./preview").PreviewManager} services.preview
 */
function registerCommands(context, { diagnostics, preview }) {
  const openPreview = (viewColumn) => async (uri) => {
    const document = await resolveDocument(uri);
    if (document) {
      preview.show(document, viewColumn);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "designMd.openPreview",
      openPreview(vscode.ViewColumn.Active),
    ),
    vscode.commands.registerCommand(
      "designMd.openPreviewToSide",
      openPreview(vscode.ViewColumn.Beside),
    ),
    vscode.commands.registerCommand("designMd.validate", async (uri) => {
      const document = await resolveDocument(uri);
      if (!document) {
        return;
      }

      diagnostics.validate(document);
      await vscode.commands.executeCommand("workbench.actions.view.problems");
    }),
    vscode.commands.registerCommand("designMd.new", createDesignFile),
    vscode.commands.registerCommand(
      "designMd.fixSectionOrder",
      fixSectionOrderCommand,
    ),
  );
}

module.exports = { registerCommands };
