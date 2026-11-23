"use strict";

/*
 * Runtime strings for modules that also run outside VS Code (the unit tests
 * load them under plain Node). Inside the extension host this defers to
 * vscode.l10n, which reads l10n/bundle.l10n.<locale>.json. Elsewhere it falls
 * back to the English source strings.
 */

/** @type {((message: string, ...args: Array<string | number>) => string) | null} */
let translate = null;

/**
 * Fill `{0}`, `{1}`… placeholders the way vscode.l10n.t does.
 * @param {string} message
 * @param {Array<string | number>} args
 * @returns {string}
 */
function format(message, args) {
  return message.replaceAll(/\{(?<index>\d+)\}/gu, (match, index) =>
    Number(index) < args.length ? String(args[index]) : match,
  );
}

function loadTranslate() {
  try {
    return require("vscode").l10n.t;
  } catch {
    return (message, ...args) => format(message, args);
  }
}

/**
 * Translate a message into the VS Code display language.
 * @param {string} message English source string, also the bundle key.
 * @param {...(string | number)} args Values for `{0}`, `{1}`… placeholders.
 * @returns {string}
 */
function localize(message, ...args) {
  translate ??= loadTranslate();
  return translate(message, ...args);
}

module.exports = { format, localize };
