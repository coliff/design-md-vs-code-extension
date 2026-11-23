"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");
const template = require("../src/template.md");

const outDir = path.join(__dirname, "../out");

/*
 * A vscode API with no workspace folder open. It records registered commands,
 * the document the New DESIGN.md command opens, and what it inserts.
 */
const vscodeStub = `
const stub = new Proxy(() => stub, {
  construct: () => stub,
  get: (_target, property) => (property === "then" ? undefined : stub),
});
const state = { commands: new Map(), inserted: [], opened: [] };
const document = { getText: () => state.inserted.join("") };
const api = {
  Position: class {
    constructor(line, character) { Object.assign(this, { character, line }); }
  },
  Uri: { parse: (value) => ({ toString: () => value }) },
  commands: {
    executeCommand: () => Promise.resolve(),
    registerCommand: (id, handler) => (state.commands.set(id, handler), stub),
  },
  state,
  window: new Proxy({}, {
    get: (_target, property) =>
      property === "showTextDocument"
        ? async () => ({
            edit: async (callback) => {
              callback({ insert: (_position, text) => state.inserted.push(text) });
              return true;
            },
          })
        : stub,
  }),
  workspace: new Proxy({}, {
    get: (_target, property) => {
      if (property === "workspaceFolders") return undefined;
      if (property === "openTextDocument") {
        return async (uri) => (state.opened.push(String(uri)), document);
      }
      return stub;
    },
  }),
};
module.exports = new Proxy(api, {
  get: (target, property) => (property in target ? target[property] : stub),
});
`;

function activate() {
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
    return require(stubDir).state;
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
}

describe("New DESIGN.md command without a folder", () => {
  it("opens an untitled DESIGN.md with the template", async () => {
    const state = activate();
    await state.commands.get("designMd.new")();
    assert.deepEqual(state.opened, ["untitled:DESIGN.md"]);
    assert.deepEqual(state.inserted, [template]);
  });

  it("does not insert the template twice", async () => {
    const state = activate();
    await state.commands.get("designMd.new")();
    await state.commands.get("designMd.new")();
    assert.deepEqual(state.inserted, [template]);
  });
});
