"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { isLintableDocument } = require("../src/analyze");

describe("isLintableDocument", () => {
  const document = (scheme) => ({
    fileName: "/repo/DESIGN.md",
    languageId: "markdown",
    uri: { scheme },
  });

  it("lints local, untitled, remote and GitHub repository files", () => {
    for (const scheme of ["file", "untitled", "vscode-remote", "vscode-vfs"]) {
      assert.equal(isLintableDocument(document(scheme)), true, scheme);
    }
  });

  it("skips the git copies VS Code opens for diffs", () => {
    assert.equal(isLintableDocument(document("git")), false);
  });
});
