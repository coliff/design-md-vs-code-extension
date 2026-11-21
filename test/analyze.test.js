"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const template = require("../src/template.md");
const {
  analyze,
  fixSectionOrderText,
  isDesignDocument,
} = require("../src/analyze");

const broken = fs.readFileSync(
  path.join(__dirname, "fixtures", "broken.md"),
  "utf8",
);
const samplesDir = path.join(__dirname, "..", "examples");

describe("analyze", () => {
  it("reports no errors or warnings for the starter template", () => {
    const { report, problems } = analyze(template);
    assert.ok(report);
    assert.deepEqual(
      problems.filter((problem) => problem.severity !== "info"),
      [],
    );
    assert.equal(
      problems.some((problem) => problem.rule === "token-summary"),
      false,
    );
  });

  it("locates a broken reference on the reference itself", () => {
    const problem = analyze(broken).problems.find(
      (item) => item.rule === "broken-ref",
    );
    assert.ok(problem);
    assert.equal(broken.slice(problem.start, problem.end), "{colors.missing}");
  });

  it("locates an orphaned token on its key", () => {
    const problem = analyze(broken).problems.find(
      (item) => item.rule === "orphaned-tokens",
    );
    assert.ok(problem);
    assert.equal(broken.slice(problem.start, problem.end), "unused");
  });

  it("locates a section-order warning on the heading", () => {
    const problem = analyze(broken).problems.find(
      (item) => item.rule === "section-order",
    );
    assert.ok(problem);
    assert.equal(broken.slice(problem.start, problem.end), "Typography");
  });

  it("returns the same cached result for identical content", () => {
    assert.equal(analyze(broken), analyze(broken));
  });

  it("lints every sample DESIGN.md without errors", () => {
    for (const sample of fs.readdirSync(samplesDir)) {
      const text = fs.readFileSync(
        path.join(samplesDir, sample, "DESIGN.md"),
        "utf8",
      );
      const { report, problems } = analyze(text);
      assert.ok(report, sample);
      assert.equal(
        problems.filter((problem) => problem.severity === "error").length,
        0,
        sample,
      );
    }
  });
});

describe("fixSectionOrderText", () => {
  it("moves Colors before Typography", () => {
    const fixed = fixSectionOrderText(broken);
    assert.ok(fixed);
    assert.ok(fixed.indexOf("## Colors") < fixed.indexOf("## Typography"));
  });

  it("returns null when sections are already in order", () => {
    assert.equal(fixSectionOrderText(template), null);
  });
});

describe("isDesignDocument", () => {
  it("matches markdown files named DESIGN.md", () => {
    assert.equal(
      isDesignDocument({ fileName: "/repo/DESIGN.md", languageId: "markdown" }),
      true,
    );
    assert.equal(
      isDesignDocument({
        fileName: String.raw`C:\repo\DESIGN.md`,
        languageId: "markdown",
      }),
      true,
    );
    assert.equal(
      isDesignDocument({ fileName: "/repo/README.md", languageId: "markdown" }),
      false,
    );
    assert.equal(
      isDesignDocument({
        fileName: "/repo/DESIGN.md",
        languageId: "plaintext",
      }),
      false,
    );
  });
});
