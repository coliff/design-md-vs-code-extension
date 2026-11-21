"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  findColorValues,
  getFrontMatter,
  isInFrontMatter,
  locateFinding,
  locatePath,
  referenceAt,
} = require("../src/locate");

const document = [
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
    const frontMatter = getFrontMatter(document);
    assert.ok(frontMatter);
    assert.equal(frontMatter.bodyStart, 4);
    assert.ok(frontMatter.body.startsWith("colors:"));
  });

  it("returns undefined without front matter", () => {
    assert.equal(getFrontMatter("# Title\n"), undefined);
  });

  it("handles CRLF line endings", () => {
    const frontMatter = getFrontMatter(document.replaceAll("\n", "\r\n"));
    assert.ok(frontMatter);
    assert.equal(frontMatter.bodyStart, 5);
  });
});

describe("locatePath", () => {
  it("finds a nested key", () => {
    const location = locatePath(document, "components.button.backgroundColor");
    assert.ok(location);
    assert.equal(
      document.slice(location.keyStart, location.keyEnd),
      "backgroundColor",
    );
  });

  it("returns undefined for a missing path", () => {
    assert.equal(locatePath(document, "colors.nope"), undefined);
  });
});

describe("locateFinding", () => {
  it("falls back to the front matter fence", () => {
    assert.deepEqual(locateFinding(document, { message: "Summary" }), {
      start: 0,
      end: 3,
    });
  });

  it("finds a section heading from the message", () => {
    const range = locateFinding(document, {
      message: "Section 'Colors' appears before 'Overview'",
    });
    assert.equal(document.slice(range.start, range.end), "Colors");
  });
});

describe("referenceAt", () => {
  it("finds the reference under the cursor", () => {
    const offset = document.indexOf("{colors.primary}") + 3;
    const reference = referenceAt(document, offset);
    assert.ok(reference);
    assert.equal(reference.path, "colors.primary");
    assert.equal(
      document.slice(reference.start, reference.end),
      "{colors.primary}",
    );
  });

  it("returns undefined away from a reference", () => {
    assert.equal(referenceAt(document, 2), undefined);
  });
});

describe("findColorValues", () => {
  it("lists hex colors with exact ranges, quoted either way", () => {
    const colors = findColorValues(document);
    assert.deepEqual(
      colors.map(({ hex }) => hex),
      ["#1A73E8", "#fff"],
    );
    for (const { start, end, hex } of colors) {
      assert.equal(document.slice(start, end), hex);
    }
  });
});

describe("isInFrontMatter", () => {
  it("distinguishes front matter from the body", () => {
    assert.equal(isInFrontMatter(document, document.indexOf("primary")), true);
    assert.equal(
      isInFrontMatter(document, document.indexOf("## Colors")),
      false,
    );
  });
});
