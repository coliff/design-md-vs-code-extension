"use strict";

const vscode = require("vscode");
const { analyze } = require("./analyze");
const { describeValue, parseHex, swatchDataUri, toHex } = require("./format");
const { nameInsertionPoint } = require("./frontmatter-rules");
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
      if (value?.type === "color") {
        markdown.appendMarkdown(
          `![${value.hex}](${swatchDataUri(value.hex)}) \`${value.hex}\``,
        );
      } else {
        markdown.appendCodeblock(describeValue(value), "text");
      }
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

function isDesignDiagnostic(diagnostic, code) {
  return diagnostic.source === "DESIGN.md" && diagnostic.code === code;
}

function sectionOrderAction(document, diagnostic) {
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
  return action;
}

function addNameAction(document, diagnostic) {
  const point = nameInsertionPoint(document.getText());
  if (!point) {
    return undefined;
  }
  const action = new vscode.CodeAction(
    vscode.l10n.t("Add 'name' to the front matter"),
    vscode.CodeActionKind.QuickFix,
  );
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  action.edit = new vscode.WorkspaceEdit();
  // A snippet leaves the cursor after `name: ` so the value can be typed.
  action.edit.set(document.uri, [
    vscode.SnippetTextEdit.insert(
      document.positionAt(point.offset),
      new vscode.SnippetString(`name: $0${point.eol}`),
    ),
  ]);
  return action;
}

/*
 * Both a missing and an empty `name` use the `missing-name` rule. Only a
 * missing one is reported on the opening `---` at the very start.
 */
function isMissingName(diagnostic) {
  const { start } = diagnostic.range;
  return (
    isDesignDiagnostic(diagnostic, "missing-name") &&
    start.line === 0 &&
    start.character === 0
  );
}

const codeActionProvider = {
  provideCodeActions(document, _range, { diagnostics }) {
    const sectionOrder = diagnostics.find((item) =>
      isDesignDiagnostic(item, "section-order"),
    );
    const missingName = diagnostics.find(isMissingName);
    return [
      sectionOrder && sectionOrderAction(document, sectionOrder),
      missingName && addNameAction(document, missingName),
    ].filter(Boolean);
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
