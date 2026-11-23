"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { format, localize } = require("../src/l10n");

const root = path.join(__dirname, "..");
const LOCALES = ["ja"];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function placeholders(message) {
  return (message.match(/\{\d+\}/gu) ?? []).toSorted();
}

/*
 * Collect the string literal passed to every `localize(...)` and
 * `vscode.l10n.t(...)`
 * call in the sources.
 */
function sourceMessages() {
  const messages = new Set();
  const srcDir = path.join(root, "src");
  for (const file of fs.readdirSync(srcDir)) {
    if (file.endsWith(".js")) {
      const text = fs.readFileSync(path.join(srcDir, file), "utf8");
      for (const match of text.matchAll(
        /\b(?:localize|t)\(\s*(?<literal>"(?:[^"\\]|\\.)*")/gu,
      )) {
        messages.add(JSON.parse(match.groups.literal));
      }
    }
  }
  return messages;
}

describe("l10n", () => {
  it("falls back to English with placeholders filled outside VS Code", () => {
    assert.equal(localize("Preview {0}", "DESIGN.md"), "Preview DESIGN.md");
    assert.equal(format("{1} and {0} {2}", ["a", 2]), "2 and a {2}");
  });

  it("lists every runtime string in the English bundle", () => {
    const bundle = readJson("l10n/bundle.l10n.json");
    const used = sourceMessages();
    assert.deepEqual([...used].toSorted(), Object.keys(bundle).toSorted());
    for (const [key, value] of Object.entries(bundle)) {
      assert.equal(value, key);
    }
  });

  it("resolves every %key% in package.json", () => {
    const nls = readJson("package.nls.json");
    const text = fs.readFileSync(path.join(root, "package.json"), "utf8");
    for (const match of text.matchAll(/"%(?<key>[^%"]+)%"/gu)) {
      assert.ok(match.groups.key in nls, match.groups.key);
    }
  });

  for (const locale of LOCALES) {
    it(`translates every string into ${locale} with the same placeholders`, () => {
      for (const [english, translated] of [
        ["l10n/bundle.l10n.json", `l10n/bundle.l10n.${locale}.json`],
        ["package.nls.json", `package.nls.${locale}.json`],
      ]) {
        const source = readJson(english);
        const target = readJson(translated);
        assert.deepEqual(Object.keys(target), Object.keys(source), translated);
        for (const [key, value] of Object.entries(source)) {
          assert.ok(target[key].trim(), `${translated}: ${key}`);
          assert.deepEqual(
            placeholders(target[key]),
            placeholders(value),
            `${translated}: ${key}`,
          );
        }
      }
    });
  }
});
