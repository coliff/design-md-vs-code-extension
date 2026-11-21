"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const css = require("../src/preview.css");
const template = require("../src/template.md");
const { analyze } = require("../src/analyze");
const { describeValue, parseHex, toHex } = require("../src/format");
const { buildPreviewHtml, escapeHtml } = require("../src/preview-html");

function render(text) {
  return buildPreviewHtml({
    cspSource: "vscode-resource:",
    css,
    nonce: "test-nonce",
    report: analyze(text).report,
    text,
  });
}

describe("buildPreviewHtml", () => {
  it("renders tokens, prose and a nonce-locked CSP", () => {
    const html = render(template);
    assert.match(html, /<h1>My Design System<\/h1>/u);
    assert.match(html, /\.color-0 \{ background: #1a73e8; \}/iu);
    assert.match(html, /<h2>Do's and Don'ts<\/h2>/u);
    assert.match(html, /style-src 'nonce-test-nonce'/u);
    assert.doesNotMatch(html, /<script/u);
    assert.doesNotMatch(html, /style="/u);
  });

  it("escapes HTML in token names and prose", () => {
    const text = template
      .replace("name: My Design System", 'name: "<img src=x onerror=alert(1)>"')
      .replace("## Overview", "## Overview\n\n<script>alert(1)</script>");
    const html = render(text);
    assert.doesNotMatch(html, /<img src=x/u);
    assert.doesNotMatch(html, /<script>alert/u);
  });

  it("renders an error state when the report is missing", () => {
    const html = buildPreviewHtml({
      cspSource: "",
      css: "",
      nonce: "n",
      report: undefined,
      text: "# Hi",
    });
    assert.match(html, /Unable to parse/u);
  });
});

describe("format helpers", () => {
  it("escapes HTML special characters", () => {
    assert.equal(
      escapeHtml(`<a href="x">'&'</a>`),
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("round-trips hex colors", () => {
    assert.equal(toHex(parseHex("#1a73e8")), "#1A73E8");
    assert.equal(toHex(parseHex("#fff")), "#FFFFFF");
    assert.equal(toHex(parseHex("#00000080")), "#00000080");
  });

  it("describes resolved values", () => {
    assert.equal(
      describeValue({ type: "dimension", unit: "px", value: 8 }),
      "8px",
    );
    assert.equal(
      describeValue({
        fontFamily: "Inter",
        fontSize: { type: "dimension", unit: "px", value: 16 },
        fontWeight: 400,
        type: "typography",
      }),
      "Inter 16px 400",
    );
  });
});
