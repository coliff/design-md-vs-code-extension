"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("yaml");
const { describe, it } = require("node:test");
const {
  SECTION_ALIASES,
  findColorValues,
  getFrontMatter,
  isInFrontMatter,
  locateFinding,
  locatePath,
  referenceAt,
} = require("../src/locate");

const doc = [
  "---",
  "colors:",
  '  primary: "#1A73E8"',
  "  surface: '#fff'",
  "components:",
  "  button:",
  '    backgroundColor: "{colors.primary}"',
  "---",
  "",
  "## Colors",
  "",
].join("\n");

describe("getFrontMatter", () => {
  it("finds the front matter block", () => {
    const frontMatter = getFrontMatter(doc);
    assert.ok(frontMatter);
    assert.equal(frontMatter.bodyStart, 4);
    assert.ok(frontMatter.body.startsWith("colors:"));
  });

  it("returns null without front matter", () => {
    assert.equal(getFrontMatter("# Title\n"), null);
  });

  it("handles CRLF line endings", () => {
    const frontMatter = getFrontMatter(doc.replaceAll("\n", "\r\n"));
    assert.ok(frontMatter);
    assert.equal(frontMatter.bodyStart, 5);
  });

  it("allows trailing whitespace after the opening fence", () => {
    const frontMatter = getFrontMatter(doc.replace("---\n", "---  \n"));
    assert.ok(frontMatter);
    assert.ok(frontMatter.body.startsWith("colors:"));
  });
});

describe("locatePath", () => {
  it("finds a nested key", () => {
    const location = locatePath(doc, "components.button.backgroundColor");
    assert.ok(location);
    assert.equal(
      doc.slice(location.keyStart, location.keyEnd),
      "backgroundColor",
    );
  });

  it("returns null for a missing path", () => {
    assert.equal(locatePath(doc, "colors.nope"), null);
  });
});

describe("locateFinding", () => {
  it("falls back to the front matter fence", () => {
    assert.deepEqual(locateFinding(doc, { message: "Summary" }), {
      start: 0,
      end: 3,
    });
  });

  it("finds a section heading from the message", () => {
    const range = locateFinding(doc, {
      message: "Section 'Colors' appears before 'Overview'",
    });
    assert.equal(doc.slice(range.start, range.end), "Colors");
  });
});

describe("referenceAt", () => {
  it("finds the reference under the cursor", () => {
    const offset = doc.indexOf("{colors.primary}") + 3;
    const reference = referenceAt(doc, offset);
    assert.ok(reference);
    assert.equal(reference.path, "colors.primary");
    assert.equal(doc.slice(reference.start, reference.end), "{colors.primary}");
  });

  it("returns null away from a reference", () => {
    assert.equal(referenceAt(doc, 2), null);
  });
});

describe("findColorValues", () => {
  it("lists hex colors with exact ranges, quoted either way", () => {
    const colors = findColorValues(doc);
    assert.deepEqual(
      colors.map(({ hex }) => hex),
      ["#1A73E8", "#fff"],
    );
    for (const { start, end, hex } of colors) {
      assert.equal(doc.slice(start, end), hex);
    }
  });
});

describe("isInFrontMatter", () => {
  it("distinguishes front matter from the body", () => {
    assert.equal(isInFrontMatter(doc, doc.indexOf("primary")), true);
    assert.equal(isInFrontMatter(doc, doc.indexOf("## Colors")), false);
  });

  it("excludes a closing fence with trailing whitespace", () => {
    const text = "---\nname: X\n---   \n";
    assert.equal(isInFrontMatter(text, text.indexOf("name")), true);
    assert.equal(isInFrontMatter(text, text.lastIndexOf("---") + 1), false);
  });
});

function specAliases() {
  const config = parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "../node_modules/@google/design.md/dist/linter/spec-config.yaml",
      ),
      "utf8",
    ),
  );
  return config.sections.flatMap(({ aliases = [], canonical }) =>
    aliases.map((alias) => [alias, canonical]),
  );
}

describe("SECTION_ALIASES", () => {
  it("matches the aliases in the installed linter's spec config", () => {
    assert.deepEqual([...SECTION_ALIASES].toSorted(), specAliases().toSorted());
  });
});
