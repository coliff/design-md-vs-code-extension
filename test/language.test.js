"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { loadProviders } = require("./load-providers");

const { codeActionProvider, colorProvider, hoverProvider } = loadProviders();

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

  it("ignores unresolved braces in the Markdown body", () => {
    const body = `${text}\n\`\`\`js\nconst label = \`{user.name}\`;\n\`\`\`\n`;
    const offset = body.indexOf("{user.name}") + 2;
    assert.equal(
      hoverProvider.provideHover(documentFor(body), offset),
      undefined,
    );
  });

  it("still resolves token references in the Markdown body", () => {
    const body = `${text}\nUse {colors.primary} for actions.\n`;
    const offset = body.lastIndexOf("{colors.primary}") + 2;
    const { contents } = hoverProvider.provideHover(documentFor(body), offset);
    assert.match(contents.value, /^\*\*colors\.primary\*\*/u);
  });
});

describe("color picker", () => {
  const red = { alpha: 1, blue: 0, green: 0, red: 1 };

  function presentationFor(original) {
    const [presentation] = colorProvider.provideColorPresentations(red, {
      document: { getText: () => original },
      range: null,
    });
    return presentation.label;
  }

  it("keeps lowercase hex values lowercase", () => {
    assert.equal(presentationFor("#1a73e8"), "#ff0000");
  });

  it("uses uppercase for uppercase or digit-only values", () => {
    assert.equal(presentationFor("#1A73E8"), "#FF0000");
    assert.equal(presentationFor("#000000"), "#FF0000");
  });
});
