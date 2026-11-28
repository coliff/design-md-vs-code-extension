"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const packageJson = require("../package.json");
const { SNIPPETS, typedSnippetPrefix } = require("../src/snippets");

describe("snippets", () => {
  it("are not contributed to every Markdown file", () => {
    assert.equal(packageJson.contributes.snippets, undefined);
  });

  it("each have a design- prefix, a description and a body", () => {
    assert.ok(SNIPPETS.length > 0);
    for (const { body, description, prefix } of SNIPPETS) {
      assert.match(prefix, /^design-[a-z]+$/u);
      assert.ok(description);
      assert.ok(body);
    }
  });

  it("preview the inserted text with placeholder defaults", () => {
    const component = SNIPPETS.find(
      ({ prefix }) => prefix === "design-component",
    );
    assert.match(component.preview, /^name:\n/u);
    assert.match(component.preview, /backgroundColor: "\{colors\.primary\}"/u);
    const frontMatter = SNIPPETS.find(
      ({ prefix }) => prefix === "design-frontmatter",
    );
    assert.doesNotMatch(frontMatter.preview, /\$/u);
  });
});

describe("typedSnippetPrefix", () => {
  it("includes hyphens in the typed prefix", () => {
    assert.deepEqual(typedSnippetPrefix("  design-col"), {
      start: 2,
      typed: "design-col",
    });
  });

  it("matches at an empty position", () => {
    assert.deepEqual(typedSnippetPrefix(""), { start: 0, typed: "" });
  });

  it("stays out of token references", () => {
    assert.equal(typedSnippetPrefix('  bg: "{col'), null);
    assert.equal(typedSnippetPrefix('  bg: "{colors.on-pri'), null);
  });
});
