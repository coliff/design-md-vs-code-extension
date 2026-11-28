"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { loadProviders } = require("./load-providers");
const { SNIPPETS } = require("../src/snippets");

const { completionProviders } = loadProviders();

describe("snippet completions", () => {
  // Token reference completions trigger on `{` and `.`; snippets on typing.
  const { provider, selector } = completionProviders.find(
    ({ triggers }) => triggers.length === 0,
  );

  function completionsFor(line) {
    const position = {
      character: line.length,
      line: 0,
      with: ({ character }) => ({ character, line: 0 }),
    };
    return provider.provideCompletionItems(
      { lineAt: () => ({ text: line }) },
      position,
    );
  }

  it("are only registered for DESIGN.md files", () => {
    assert.deepEqual(selector, {
      language: "markdown",
      pattern: "**/DESIGN.md",
    });
  });

  it("replace the whole hyphenated prefix", () => {
    const items = completionsFor("  design-col");
    const color = items.find((item) => item.label.label === "design-color");
    assert.equal(color.kind, "snippet");
    assert.equal(color.label.description, "Color token");
    assert.equal(
      color.insertText.value,
      SNIPPETS.find(({ prefix }) => prefix === "design-color").body,
    );
    assert.deepEqual(color.range.start, { character: 2, line: 0 });
    assert.equal(color.range.end.character, 12);
    assert.equal(color.documentation.value, '[markdown] name: "#000000"');
  });

  it("are not offered inside token references", () => {
    assert.equal(completionsFor('    textColor: "{colors.'), undefined);
  });
});
