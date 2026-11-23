"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");
const packageJson = require("../package.json");

const outDir = path.join(__dirname, "../out");

/*
 * A stand-in for the vscode API: it records registered commands and answers
 * every other property access or call with itself.
 */
const vscodeStub = `
const registered = [];
const stub = new Proxy(() => stub, {
  construct: () => stub,
  get: (_target, property) => (property === "then" ? undefined : stub),
});
module.exports = new Proxy({ registered }, {
  get: (target, property) => {
    if (property === "registered") return registered;
    if (property !== "commands") return stub;
    return {
      executeCommand: () => Promise.resolve(),
      registerCommand: (id) => (registered.push(id), stub),
    };
  },
});
`;

describe("extension bundle", () => {
  it("ships the design.md spec config next to the bundle", () => {
    const specConfig = path.join(outDir, "spec-config.yaml");
    const text = fs.readFileSync(specConfig, "utf8");
    assert.match(text, /^version:/mu);
  });

  it("registers every contributed command even without the spec config", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-md-"));
    try {
      const stubDir = path.join(dir, "node_modules/vscode");
      fs.mkdirSync(stubDir, { recursive: true });
      fs.writeFileSync(path.join(stubDir, "index.js"), vscodeStub);
      fs.copyFileSync(
        path.join(outDir, "extension.js"),
        path.join(dir, "extension.js"),
      );

      require(path.join(dir, "extension.js")).activate({ subscriptions: [] });

      const { registered } = require(stubDir);
      const contributed = packageJson.contributes.commands.map(
        ({ command }) => command,
      );
      assert.deepEqual(registered.toSorted(), contributed.toSorted());
    } finally {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });
});
