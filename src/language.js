"use strict";

const vscode = require("vscode");
const { analyze } = require("./analyze");
const { describeValue, parseHex, toHex } = require("./format");
const { findColorValues, isInFrontMatter, referenceAt } = require("./locate");

const SELECTOR = { language: "markdown", pattern: "**/DESIGN.md" };
const OPEN_REFERENCE = /\{(?<partial>[\w.-]*)$/u;

function symbolTableFor(document) {
  return (
    analyze(document.getText()).report?.designSystem.symbolTable ?? new Map()
  );
}

const completionProvider = {
  provideCompletionItems(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    if (!isInFrontMatter(text, offset)) {
      return undefined;
    }
    const linePrefix = document
      .lineAt(position.line)
      .text.slice(0, position.character);
    const match = OPEN_REFERENCE.exec(linePrefix);
    if (!match) {
      return undefined;
    }
    const replaceRange = new vscode.Range(
      position.translate(0, -match.groups.partial.length),
      position,
    );
    const hasClosingBrace =
      document.lineAt(position.line).text.charAt(position.character) === "}";
    return [...symbolTableFor(document)].map(([path, value]) => {
      const isColor = value?.type === "color";
      const item = new vscode.CompletionItem(
        path,
        isColor
          ? vscode.CompletionItemKind.Color
          : vscode.CompletionItemKind.Constant,
      );
      item.detail = describeValue(value);
      if (isColor) {
        item.documentation = value.hex;
      }
      item.insertText = hasClosingBrace ? path : `${path}}`;
      item.range = replaceRange;
      return item;
    });
  },
};

const hoverProvider = {
  provideHover(document, position) {
    const reference = referenceAt(
      document.getText(),
      document.offsetAt(position),
    );
    if (!reference) {
      return undefined;
    }
    const value = symbolTableFor(document).get(reference.path);
    const markdown = new vscode.MarkdownString();
    if (value === undefined) {
      markdown.appendMarkdown(
        vscode.l10n.t("Unresolved reference `{0}`", reference.path),
      );
    } else {
      markdown.appendMarkdown(`**${reference.path}**\n\n`);
      markdown.appendCodeblock(describeValue(value), "text");
    }
    const range = new vscode.Range(
      document.positionAt(reference.start),
      document.positionAt(reference.end),
    );
    return new vscode.Hover(markdown, range);
  },
};

const colorProvider = {
  provideColorPresentations(color) {
    return [new vscode.ColorPresentation(toHex(color))];
  },
  provideDocumentColors(document) {
    return findColorValues(document.getText()).map(({ start, end, hex }) => {
      const { red, green, blue, alpha } = parseHex(hex);
      return new vscode.ColorInformation(
        new vscode.Range(document.positionAt(start), document.positionAt(end)),
        new vscode.Color(red, green, blue, alpha),
      );
    });
  },
};

const codeActionProvider = {
  provideCodeActions(document, _range, context) {
    const diagnostic = context.diagnostics.find(
      (item) => item.source === "DESIGN.md" && item.code === "section-order",
    );
    if (!diagnostic) {
      return [];
    }
    const action = new vscode.CodeAction(
      vscode.l10n.t("Reorder sections to match the DESIGN.md spec"),
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    action.command = {
      arguments: [document.uri],
      command: "designMd.fixSectionOrder",
      title: action.title,
    };
    return [action];
  },
};

/**
 * @param {vscode.ExtensionContext} context
 */
function registerLanguageFeatures(context) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      SELECTOR,
      completionProvider,
      "{",
      ".",
    ),
    vscode.languages.registerHoverProvider(SELECTOR, hoverProvider),
    vscode.languages.registerColorProvider(SELECTOR, colorProvider),
    vscode.languages.registerCodeActionsProvider(SELECTOR, codeActionProvider, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
  );
}

module.exports = { registerLanguageFeatures, SELECTOR };
