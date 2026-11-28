"use strict";

const definitions = require("./snippets.json");

/*
 * Markdown's word pattern stops at hyphens, so VS Code would only replace
 * "frontmatter" in "design-frontmatter". Find the whole prefix being typed.
 */
const TYPED_PREFIX = /[\w-]*$/u;
const PLACEHOLDER = /\$\{\d+:(?<value>[^}]*)\}/gu;
const TABSTOP = /\$\d+/gu;

/**
 * The snippets offered in DESIGN.md files.
 * `body` is the snippet syntax to insert and `preview` the text it inserts
 * with the default placeholder values, for the completion details.
 * @type {Array<{ prefix: string, description: string, body: string, preview: string }>}
 */
const SNIPPETS = Object.values(definitions).map(
  ({ body, description, prefix }) => {
    const text = body.join("\n");
    return {
      body: text,
      description,
      prefix,
      preview: text.replaceAll(PLACEHOLDER, "$<value>").replaceAll(TABSTOP, ""),
    };
  },
);

/**
 * Find the snippet prefix typed before the cursor.
 * @param {string} linePrefix The line's text up to the cursor.
 * @returns {{ start: number, typed: string } | null} The column the prefix
 * starts at, or null inside a `{colors.primary}` style token reference,
 * where token completions apply instead.
 */
function typedSnippetPrefix(linePrefix) {
  const [typed] = TYPED_PREFIX.exec(linePrefix);
  const start = linePrefix.length - typed.length;
  if (/[{.]$/u.test(linePrefix.slice(0, start))) {
    return null;
  }
  return { start, typed };
}

module.exports = { SNIPPETS, typedSnippetPrefix };
