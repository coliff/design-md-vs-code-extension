"use strict";

/* eslint-disable max-statements, complexity, no-continue -- test harness builds an isolated vscode stub */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");

/**
 * Build a temporary extension folder with a vscode stub and load src/commands.js.
 * @param {object} [options]
 * @param {object} [options.config]
 * @param {"FileNotFound" | "NoPermissions"} [options.statCode]
 */
function loadCommands({ config = {}, statCode = "FileNotFound" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-md-cmd-"));
  const stubDir = path.join(dir, "node_modules/vscode");
  fs.mkdirSync(stubDir, { recursive: true });
  const workspaceModules = path.join(__dirname, "../node_modules");
  for (const name of fs.readdirSync(workspaceModules)) {
    if (name === ".bin" || name === "vscode") {
      continue;
    }
    const target = path.join(workspaceModules, name);
    const link = path.join(dir, "node_modules", name);
    if (!fs.existsSync(link)) {
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(target, link, "dir");
    }
  }
  fs.writeFileSync(
    path.join(stubDir, "index.js"),
    `
const state = ${JSON.stringify({
      config: { debounceMs: 300, enable: true, ...config },
      errors: [],
      executed: [],
      info: [],
      validated: 0,
      warnings: [],
      writeFile: [],
    })};
state.commands = new Map();
class FileSystemError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "FileSystemError";
    this.code = code;
  }
}
const stub = new Proxy(() => stub, {
  construct: () => stub,
  get: (_target, property) => (property === "then" ? undefined : stub),
});
const fileDocument = {
  eol: 1,
  fileName: "/ws/DESIGN.md",
  getText: () => "---\\nname: Test\\n---\\n",
  languageId: "markdown",
  positionAt: (offset) => ({ character: offset, line: 0 }),
  uri: { scheme: "file", toString: () => "file:///ws/DESIGN.md" },
};
const gitDocument = {
  ...fileDocument,
  uri: { scheme: "git", toString: () => "git:///ws/DESIGN.md" },
};
const statCode = ${JSON.stringify(statCode)};
const api = {
  EndOfLine: { CRLF: 2, LF: 1 },
  FileSystemError,
  Position: class { constructor(line, character) { this.line = line; this.character = character; } },
  Range: class { constructor(start, end) { this.start = start; this.end = end; } },
  Uri: {
    joinPath: () => ({ path: "/ws/DESIGN.md", scheme: "file" }),
    parse: (value) => ({ toString: () => value }),
  },
  WorkspaceEdit: class { replace() { return stub; } },
  commands: {
    executeCommand: (id) => { state.executed.push(id); return Promise.resolve(); },
    registerCommand: (id, handler) => { state.commands.set(id, handler); return stub; },
  },
  l10n: { t: (message) => message },
  state,
  window: {
    activeTextEditor: { document: fileDocument },
    showErrorMessage: (message) => { state.errors.push(message); return Promise.resolve(); },
    showInformationMessage: (message) => { state.info.push(message); return Promise.resolve(); },
    showTextDocument: () => Promise.resolve({ edit: () => Promise.resolve(true) }),
    showWarningMessage: (message) => { state.warnings.push(message); return Promise.resolve(); },
  },
  workspace: {
    applyEdit: () => Promise.resolve(true),
    fs: {
      stat: () => Promise.reject(Object.assign(new FileSystemError("Denied", statCode), { name: "FileSystemError" })),
      writeFile: (...args) => { state.writeFile.push(args); return Promise.resolve(); },
    },
    getConfiguration: () => ({
      get: (key, defaultValue) => state.config[key] ?? defaultValue,
    }),
    openTextDocument: (uri) =>
      Promise.resolve(uri?.scheme === "git" ? gitDocument : fileDocument),
    workspaceFolders: [{ uri: { scheme: "file", path: "/ws" } }],
  },
};
module.exports = new Proxy(api, {
  get: (target, property) => (property in target ? target[property] : stub),
});
`,
  );

  for (const file of fs.readdirSync(path.join(__dirname, "../src"))) {
    fs.copyFileSync(path.join(__dirname, "../src", file), path.join(dir, file));
  }

  const previousPath = module.paths.slice();
  module.paths.unshift(dir);
  const vscode = require(path.join(stubDir, "index.js"));
  const { registerCommands } = require(path.join(dir, "commands.js"));
  registerCommands(
    { subscriptions: [] },
    {
      diagnostics: {
        validate: () => {
          vscode.state.validated += 1;
        },
      },
      preview: { show: () => undefined },
    },
  );
  const runtimeState = vscode.state;
  module.paths = previousPath;
  fs.rmSync(dir, { force: true, recursive: true });
  return runtimeState;
}

describe("Validate DESIGN.md command", () => {
  it("warns and does not open Problems on a git: copy", async () => {
    const state = loadCommands();
    await state.commands.get("designMd.validate")({
      scheme: "git",
      toString: () => "git:///ws/DESIGN.md",
    });
    assert.equal(state.validated, 0);
    assert.equal(state.executed.length, 0);
    assert.match(state.warnings.join(" "), /read-only/iu);
  });

  it("explains when validation is disabled", async () => {
    const state = loadCommands({ config: { enable: false } });
    await state.commands.get("designMd.validate")();
    assert.equal(state.validated, 0);
    assert.equal(state.executed.length, 0);
    assert.match(state.info.join(" "), /disabled/iu);
  });

  it("validates lintable files and opens Problems", async () => {
    const state = loadCommands();
    await state.commands.get("designMd.validate")();
    assert.equal(state.validated, 1);
    assert.deepEqual(state.executed, ["workbench.actions.view.problems"]);
  });
});

describe("New DESIGN.md command stat errors", () => {
  it("reports access errors instead of overwriting", async () => {
    const state = loadCommands({ statCode: "NoPermissions" });
    await state.commands.get("designMd.new")();
    assert.equal(state.writeFile.length, 0);
    assert.match(state.errors.join(" "), /Could not access/iu);
  });
});

describe("Fix Section Order on read-only copies", () => {
  it("warns on git: schemes without editing", async () => {
    const state = loadCommands();
    await state.commands.get("designMd.fixSectionOrder")({
      scheme: "git",
      toString: () => "git:///ws/DESIGN.md",
    });
    assert.match(state.warnings.join(" "), /read-only/iu);
  });
});
