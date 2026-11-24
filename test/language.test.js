"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, describe, it } = require("node:test");

const outDir = path.join(__dirname, "../out");

/*
 * Just enough of the vscode API to activate the bundle and capture its code
 * action and hover providers: plain classes that record what they were built with, and a
 * catch-all for everything else.
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
  Hover: class {
    constructor(contents, range) { Object.assign(this, { contents, range }); }
  },
  MarkdownString: class {
    constructor() { this.value = ""; }
    appendCodeblock(code, language) {
      this.value += "[" + language + "] " + code;
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
  languages: new Proxy({}, {
    get: (_target, property) => {
      const name = {
        registerCodeActionsProvider: "codeActionProvider",
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

const { codeActionProvider, hoverProvider } = loadProviders();

function documentFor(text) {
  return {
    getText: () => text,
    offsetAt: (offset) => offset,
    positionAt: (offset) => {
      const before = text.slice(0, offset).split("\n");
      return { character: before.at(-1).length, line: before.length - 1 };
    },
    uri: "file:///DESIGN.md",
  };
}

function diagnostic(code, line = 0, character = 0) {
  return { code, range: { start: { character, line } }, source: "DESIGN.md" };
}

function actionsFor(text, diagnostics) {
  return codeActionProvider.provideCodeActions(documentFor(text), null, {
    diagnostics,
  });
}

describe("code actions", () => {
  const text = "---\ncolors:\n  primary: '#000'\n---\n";

  it("offers to add a missing name on the line after the opening ---", () => {
    const missing = diagnostic("missing-name");
    const [action] = actionsFor(text, [missing]);
    assert.equal(action.title, "Add 'name' to the front matter");
    assert.equal(action.kind, "quickfix");
    assert.equal(action.isPreferred, true);
    assert.deepEqual(action.diagnostics, [missing]);
    const [{ edits, uri }] = action.edit.entries;
    assert.equal(uri, "file:///DESIGN.md");
    assert.equal(edits.length, 1);
    const [{ position, snippet }] = edits;
    assert.deepEqual(position, { character: 0, line: 1 });
    assert.equal(snippet.value, "name: $0\n");
  });

  it("keeps CRLF line endings in the inserted line", () => {
    const [action] = actionsFor(text.replaceAll("\n", "\r\n"), [
      diagnostic("missing-name"),
    ]);
    assert.equal(action.edit.entries[0].edits[0].snippet.value, "name: $0\r\n");
  });

  it("does not offer it for an empty name on its own line", () => {
    const empty = "---\nname:\n---\n";
    assert.deepEqual(actionsFor(empty, [diagnostic("missing-name", 1)]), []);
  });

  it("does not offer it for other sources or rules", () => {
    const other = { ...diagnostic("missing-name"), source: "other" };
    assert.deepEqual(
      actionsFor(text, [other, diagnostic("duplicate-key")]),
      [],
    );
  });

  it("still offers to reorder sections, once", () => {
    const actions = actionsFor(text, [
      diagnostic("section-order", 5),
      diagnostic("section-order", 9),
      diagnostic("missing-name"),
    ]);
    assert.deepEqual(
      actions.map((action) => action.title),
      [
        "Reorder sections to match the DESIGN.md spec",
        "Add 'name' to the front matter",
      ],
    );
    assert.equal(actions[0].command.command, "designMd.fixSectionOrder");
  });
});

describe("hover", () => {
  const text = [
    "---",
    "name: Test",
    "colors:",
    "  primary: '#1a73e8'",
    "rounded:",
    "  sm: 4px",
    "components:",
    "  button:",
    "    backgroundColor: '{colors.primary}'",
    "    rounded: '{rounded.sm}'",
    "    textColor: '{colors.missing}'",
    "---",
    "",
  ].join("\n");

  function hoverAt(reference) {
    const offset = text.indexOf(reference) + 2;
    return hoverProvider.provideHover(documentFor(text), offset);
  }

  it("shows a swatch next to the hex value of a color reference", () => {
    const { contents } = hoverAt("{colors.primary}");
    const svg = encodeURIComponent("fill='#1a73e8'");
    assert.match(contents.value, /^\*\*colors\.primary\*\*/u);
    assert.ok(
      contents.value.includes(`![#1a73e8](data:image/svg+xml,`),
      contents.value,
    );
    assert.ok(contents.value.includes(svg), contents.value);
    assert.ok(contents.value.endsWith(") `#1a73e8`"), contents.value);
  });

  it("shows other values without a swatch", () => {
    const { contents } = hoverAt("{rounded.sm}");
    assert.ok(contents.value.includes("4px"), contents.value);
    assert.ok(!contents.value.includes("data:image"), contents.value);
  });

  it("reports unresolved references without a swatch", () => {
    const { contents } = hoverAt("{colors.missing}");
    assert.equal(contents.value, "Unresolved reference `colors.missing`");
  });

  it("returns nothing outside a reference", () => {
    assert.equal(
      hoverProvider.provideHover(documentFor(text), text.indexOf("name")),
      undefined,
    );
  });
});
