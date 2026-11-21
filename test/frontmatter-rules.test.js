"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { analyze } = require("../src/analyze");
const {
  checkFrontMatter,
  isUpstreamDuplicateKey,
} = require("../src/frontmatter-rules");
const template = require("../src/template.md");

function doc(...lines) {
  return [...lines, "", "## Colors", ""].join("\n");
}

function byRule(problems, rule) {
  return problems.filter((problem) => problem.rule === rule);
}

describe("checkFrontMatter", () => {
  it("reports nothing for the starter template", () => {
    assert.deepEqual(checkFrontMatter(template), []);
  });

  it("reports nothing when there is no front matter", () => {
    assert.deepEqual(checkFrontMatter("# Title\n"), []);
  });

  it("flags a missing name on the opening delimiter", () => {
    const text = doc("---", "colors:", '  primary: "#000000"', "---");
    const [problem] = byRule(checkFrontMatter(text), "missing-name");
    assert.ok(problem);
    assert.equal(problem.severity, "error");
    assert.equal(text.slice(problem.start, problem.end), "---");
  });

  it("flags a missing name in empty front matter", () => {
    const text = doc("---", "---");
    assert.equal(byRule(checkFrontMatter(text), "missing-name").length, 1);
  });

  it("flags an empty or non-string name on its key", () => {
    for (const value of ["", ' ""', " 42", " [a, b]"]) {
      const text = doc("---", `name:${value}`, "---");
      const [problem] = byRule(checkFrontMatter(text), "missing-name");
      assert.ok(problem, value);
      assert.equal(text.slice(problem.start, problem.end), "name", value);
    }
  });

  it("accepts a name in any key position", () => {
    const text = doc(
      "---",
      "colors:",
      '  primary: "#000"',
      "name: Late",
      "---",
    );
    assert.deepEqual(byRule(checkFrontMatter(text), "missing-name"), []);
  });

  it("flags a duplicate key in colors on the second occurrence", () => {
    const text = doc(
      "---",
      "name: Dupes",
      "colors:",
      '  primary: "#000000"',
      '  surface: "#ffffff"',
      '  primary: "#111111"',
      "---",
    );
    const problems = byRule(checkFrontMatter(text), "duplicate-key");
    assert.equal(problems.length, 1);
    const [problem] = problems;
    assert.equal(problem.severity, "error");
    assert.equal(text.slice(problem.start, problem.end), "primary");
    assert.equal(problem.start, text.lastIndexOf("primary"));
    assert.match(problem.message, /'primary' in 'colors'/u);
    assert.match(problem.message, /line 4/u);
  });

  it("flags every repeat of the same key", () => {
    const text = doc(
      "---",
      "name: Dupes",
      "colors:",
      '  a: "#000"',
      '  a: "#111"',
      '  a: "#222"',
      "---",
    );
    assert.equal(byRule(checkFrontMatter(text), "duplicate-key").length, 2);
  });

  it("flags duplicate keys at the top level and in nested maps", () => {
    const text = doc(
      "---",
      "name: One",
      "name: Two",
      "components:",
      "  button:",
      "    textColor: '#000'",
      "    textColor: '#fff'",
      "---",
    );
    const messages = byRule(checkFrontMatter(text), "duplicate-key").map(
      (problem) => problem.message,
    );
    assert.equal(messages.length, 2);
    assert.match(messages[0], /'name' in the front matter/u);
    assert.match(messages[1], /'textColor' in 'components\.button'/u);
  });

  it("does not treat the same key in different maps as a duplicate", () => {
    const text = doc(
      "---",
      "name: Fine",
      "colors:",
      '  primary: "#000"',
      "components:",
      "  primary:",
      "    textColor: '{colors.primary}'",
      "---",
    );
    assert.deepEqual(byRule(checkFrontMatter(text), "duplicate-key"), []);
  });
});

describe("analyze with front matter rules", () => {
  it("replaces the upstream duplicate-key warning with located findings", () => {
    const text = doc(
      "---",
      "name: Dupes",
      "colors:",
      '  primary: "#000000"',
      '  primary: "#111111"',
      "---",
    );
    const { problems } = analyze(text);
    assert.equal(byRule(problems, "duplicate-key").length, 1);
    assert.equal(
      problems.filter((problem) => isUpstreamDuplicateKey(problem)).length,
      0,
    );
  });

  it("reports a missing name alongside upstream findings", () => {
    const text = doc("---", "colors:", '  primary: "#000000"', "---");
    const { report, problems } = analyze(text);
    assert.ok(report);
    assert.equal(byRule(problems, "missing-name").length, 1);
  });
});
