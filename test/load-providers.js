"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after } = require("node:test");

const outDir = path.join(__dirname, "../out");

/*
 * Just enough of the vscode API to activate the bundle and capture its code
 * action, color, completion and hover providers: plain classes that record
 * what they were built with, and a catch-all for everything else.
 */
const vscodeStub = `
const stub = new Proxy(() => stub, {
  construct: () => stub,
  get: (_target, property) => (property === "then" ? undefined : stub),
});
const api = {
  CodeAction: class {
    constructor(title, kind) { Object.assign(this, { kind, title }); }
  },
  CodeActionKind: { QuickFix: "quickfix" },
  CompletionItem: class {
    constructor(label, kind) { Object.assign(this, { kind, label }); }
  },
  CompletionItemKind: { Snippet: "snippet" },
  ColorPresentation: class {
    constructor(label) { this.label = label; }
  },
  Hover: class {
    constructor(contents, range) { Object.assign(this, { contents, range }); }
  },
  MarkdownString: class {
    constructor() { this.value = ""; }
    appendCodeblock(code, language) {
      this.value += "[" + language + "] " + code;
      return this;
    }
    appendMarkdown(markdown) { this.value += markdown; }
  },
  Range: class {
    constructor(start, end) { Object.assign(this, { end, start }); }
  },
  SnippetString: class {
    constructor(value) { this.value = value; }
  },
  SnippetTextEdit: { insert: (position, snippet) => ({ position, snippet }) },
  WorkspaceEdit: class {
    constructor() { this.entries = []; }
    set(uri, edits) { this.entries.push({ edits, uri }); }
  },
  l10n: {
    t: (message, ...args) =>
      message.replace(/\\{(\\d+)\\}/gu, (_match, index) => args[index]),
  },
  completionProviders: [],
  languages: new Proxy({}, {
    get: (_target, property) => {
      if (property === "registerCompletionItemProvider") {
        return (selector, provider, ...triggers) => (
          api.completionProviders.push({ provider, selector, triggers }), stub
        );
      }
      const name = {
        registerCodeActionsProvider: "codeActionProvider",
        registerColorProvider: "colorProvider",
        registerHoverProvider: "hoverProvider",
      }[property];
      return name
        ? (_selector, provider) => ((api[name] = provider), stub)
        : stub;
    },
  }),
};
module.exports = new Proxy(api, {
  get: (target, property) => (property in target ? target[property] : stub),
});
`;

/*
 * The bundle loads the linter and its spec config on first use, so the copy
 * has to stay on disk until the tests are done.
 */
function loadProviders() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-md-"));
  after(() => fs.rmSync(dir, { force: true, recursive: true }));
  const stubDir = path.join(dir, "node_modules/vscode");
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(path.join(stubDir, "index.js"), vscodeStub);
  for (const file of ["extension.js", "spec-config.yaml"]) {
    fs.copyFileSync(path.join(outDir, file), path.join(dir, file));
  }
  require(path.join(dir, "extension.js")).activate({ subscriptions: [] });
  return require(stubDir);
}

module.exports = { loadProviders };
