"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

describe("extension bundle", () => {
  it("ships the design.md spec config next to the bundle", () => {
    const specConfig = path.join(__dirname, "../out/spec-config.yaml");
    const text = fs.readFileSync(specConfig, "utf8");
    assert.match(text, /^version:/mu);
  });
});
