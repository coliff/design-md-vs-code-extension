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
  isLintableDocument,
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

  it("locates a section-order warning on a heading with an apostrophe", () => {
    const dosIndex = template.indexOf("## Do's and Don'ts");
    const dos = template.slice(dosIndex);
    const reordered = template
      .slice(0, dosIndex)
      .replace("## Colors", `${dos}\n## Colors`);
    const problem = analyze(reordered).problems.find(
      (item) => item.rule === "section-order",
    );
    assert.ok(problem);
    assert.equal(
      reordered.slice(problem.start, problem.end),
      "Do's and Don'ts",
    );
  });

  it("locates a section-order warning on an alias heading", () => {
    const text = template
      .replace("## Layout\n", "## Layout & Spacing\n")
      .replace("## Colors\n", "## Colors-old\n")
      .replace(
        "## Overview\n",
        "## Overview\n\n## Layout & Spacing\n\n## Colors\n",
      );
    const problem = analyze(text).problems.find(
      (item) => item.rule === "section-order",
    );
    assert.ok(problem);
    assert.equal(text.slice(problem.start, problem.end), "Layout & Spacing");
    assert.equal(problem.start, text.indexOf("## Layout & Spacing") + 3);
  });

  it("skips YAML comments and fenced code when locating a section", () => {
    const text = [
      "---",
      "name: Test",
      "# Colors",
      "colors:",
      '  primary: "#000000"',
      "---",
      "",
      "```md",
      "## Colors",
      "```",
      "",
      "## Colors ##",
      "",
      "## Overview",
      "",
    ].join("\n");
    const problem = analyze(text).problems.find(
      (item) => item.rule === "section-order",
    );
    assert.ok(problem);
    assert.equal(problem.start, text.indexOf("## Colors ##") + 3);
    assert.equal(text.slice(problem.start, problem.end), "Colors");
  });

  it("locates a duplicate section on its key in the code block", () => {
    const text = [
      "---",
      "name: Test",
      "colors:",
      '  primary: "#000000"',
      "---",
      "",
      "```yaml",
      "colors:",
      '  secondary: "#ffffff"',
      "```",
      "",
    ].join("\n");
    const problem = analyze(text).problems.find((item) =>
      item.message.includes("is defined in both"),
    );
    assert.ok(problem);
    assert.equal(problem.start, text.indexOf("```yaml\ncolors") + 8);
    assert.equal(text.slice(problem.start, problem.end), "colors");
  });

  it("summarizes the located problems, not the raw linter findings", () => {
    const text = template.replace("name: My Design System\n", "");
    const { problems, report, summary } = analyze(text);
    assert.ok(report);
    assert.equal(summary.errors, 1);
    assert.equal(
      summary.errors + summary.warnings + summary.infos,
      problems.length,
    );
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

describe("analyze contrastRatio option", () => {
  const lowContrast = template.replace(
    'textColor: "{colors.on-primary}"',
    'textColor: "{colors.primary}"',
  );

  it("reports contrast-ratio warnings by default", () => {
    const { problems, summary } = analyze(lowContrast);
    assert.ok(problems.some((problem) => problem.rule === "contrast-ratio"));
    assert.equal(summary.warnings, analyze(lowContrast, {}).summary.warnings);
  });

  it("hides contrast-ratio warnings and updates the summary", () => {
    const shown = analyze(lowContrast, { contrastRatio: true });
    const hidden = analyze(lowContrast, { contrastRatio: false });
    const contrastCount = shown.problems.filter(
      (problem) => problem.rule === "contrast-ratio",
    ).length;
    assert.ok(contrastCount > 0);
    assert.equal(
      hidden.problems.some((problem) => problem.rule === "contrast-ratio"),
      false,
    );
    assert.equal(hidden.problems.length, shown.problems.length - contrastCount);
    assert.equal(
      hidden.summary.warnings,
      shown.summary.warnings - contrastCount,
    );
    assert.equal(hidden.report, shown.report);
  });

  it("does not alter the cached result when hiding warnings", () => {
    analyze(lowContrast, { contrastRatio: false });
    assert.ok(
      analyze(lowContrast).problems.some(
        (problem) => problem.rule === "contrast-ratio",
      ),
    );
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

  it("keeps CRLF line endings when reordering", () => {
    const crlf = broken.replaceAll("\n", "\r\n");
    const fixed = fixSectionOrderText(crlf);
    assert.equal(fixed, fixSectionOrderText(broken).replaceAll("\n", "\r\n"));
    assert.doesNotMatch(fixed, /\r(?!\n)|(?<!\r)\n/u);
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

describe("isLintableDocument", () => {
  const document = (scheme) => ({
    fileName: "/repo/DESIGN.md",
    languageId: "markdown",
    uri: { scheme },
  });

  it("lints files on disk and untitled files", () => {
    assert.equal(isLintableDocument(document("file")), true);
    assert.equal(isLintableDocument(document("untitled")), true);
  });

  it("skips the git copies VS Code opens for diffs", () => {
    assert.equal(isLintableDocument(document("git")), false);
  });
});
