"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const css = require("../src/preview.css");
const template = require("../src/template.md");
const { analyze } = require("../src/analyze");
const {
  describeValue,
  parseHex,
  swatchDataUri,
  toHex,
} = require("../src/format");
const {
  buildPreviewHtml,
  escapeHtml,
  relativeImagePath,
} = require("../src/preview-html");

function render(text, options = {}) {
  const { problems, report } = analyze(text);
  return buildPreviewHtml({
    cspSource: "vscode-resource:",
    css,
    nonce: "test-nonce",
    problems,
    report,
    text,
    ...options,
  });
}

describe("buildPreviewHtml", () => {
  it("does not round a contrast ratio up past a WCAG threshold", () => {
    // #7071AF on white is 4.4968:1, just below AA.
    const html = render(
      '---\nname: Test\ncolors:\n  primary: "#7071AF"\n---\n',
      { contrastBadges: true },
    );
    assert.match(html, /on white 4\.49 AA Large/u);
  });

  it("hides the swatch contrast badges by default", () => {
    const html = render(
      '---\nname: Test\ncolors:\n  primary: "#7071AF"\n---\n',
    );
    assert.doesNotMatch(html, /on white/u);
    assert.doesNotMatch(html, /on black/u);
  });

  it("lists lint results after the prose and hides zero counts", () => {
    const html = render(template);
    assert.ok(html.indexOf("Lint results") > html.indexOf("Do's and Don'ts"));
    assert.doesNotMatch(html, /0 errors|0 warnings|0 info/u);
  });

  it("leaves out the lint results when validation is disabled", () => {
    const html = render('---\ncolors:\n  primary: "#1A73E8"\n---\n', {
      showLintResults: false,
    });
    assert.doesNotMatch(html, /Lint results|Missing required/u);
  });

  it("lists each problem with its severity and line", () => {
    const html = render('---\ncolors:\n  primary: "#1A73E8"\n---\n');
    assert.match(
      html,
      /badge fail">Error<\/span><span class="message">Missing required &#39;name&#39;/u,
    );
    assert.match(html, />1 error</u);
    assert.match(html, /Line \d+/u);
  });

  it("uses singular and plural wording in the lint counts", () => {
    const problem = (severity) => ({
      end: 3,
      message: "Problem",
      severity,
      start: 0,
    });
    const counts = (problems) =>
      render(template, { problems }).match(
        /<span class="counts">(?<badges>.*?)<\/span><\/h2>/u,
      ).groups.badges;
    const single = counts([
      problem("error"),
      problem("warning"),
      problem("info"),
    ]);
    assert.match(single, />1 error</u);
    assert.match(single, />1 warning</u);
    assert.match(single, />1 info message</u);
    const several = counts(
      ["error", "warning", "info"].flatMap((severity) => [
        problem(severity),
        problem(severity),
      ]),
    );
    assert.match(several, />2 errors</u);
    assert.match(several, />2 warnings</u);
    assert.match(several, />2 info messages</u);
  });

  it("previews components with their resolved styles", () => {
    const html = render(template);
    assert.match(html, /component-sample component-0">Button</u);
    assert.match(
      html,
      /\.component-0 \{ background: #1a73e8; color: #ffffff;/iu,
    );
  });

  it("renders tokens, prose, the document URI and a nonce-locked CSP", () => {
    const html = render(template, { documentUri: 'file:///a/"b"/DESIGN.md' });
    assert.match(
      html,
      /<body data-uri="file:\/\/\/a\/&quot;b&quot;\/DESIGN\.md">/u,
    );
    assert.match(html, /<h1>My Design System<\/h1>/u);
    assert.match(html, /\.color-0 \{ background: #1a73e8; color: #000; \}/iu);
    assert.match(html, /<h2>Do's and Don'ts<\/h2>/u);
    assert.match(html, /style-src 'nonce-test-nonce'/u);
    assert.match(html, /script-src 'nonce-test-nonce'/u);
    assert.equal(html.match(/<script/gu).length, 1);
    assert.match(html, /<script nonce="test-nonce">/u);
    assert.doesNotMatch(html, /style="/u);
  });

  it("rewrites prose image sources with resolveImage", () => {
    const text = `${template}\n![Logo](./logo.png)\n![Remote](https://example.com/a.png)\n`;
    const html = render(text, {
      resolveImage: (src) =>
        relativeImagePath(src) ? `https://webview/${src}` : undefined,
    });
    assert.match(
      html,
      /<img src="https:\/\/webview\/\.\/logo\.png" alt="Logo">/u,
    );
    assert.match(
      html,
      /<img src="https:\/\/example\.com\/a\.png" alt="Remote">/u,
    );
    assert.match(render(text), /<img src="\.\/logo\.png" alt="Logo">/u);
  });

  it("adds swatches to colors in the prose", () => {
    const html = render(
      "# Title\n\nStrictly white (#FFFFFF) or silver (#E2E8F0), not rgb(0, 0, 0) or hsl(210 40% 96% / 0.5). Also #fff and #FFFFFF.\n",
    );
    assert.match(
      html,
      /\(<span class="prose-color"><span class="inline-swatch prose-color-0" aria-hidden="true"><\/span>#FFFFFF<\/span>\)/u,
    );
    assert.match(html, /\.prose-color-0 \{ background: #FFFFFF; \}/u);
    assert.match(html, /\.prose-color-1 \{ background: #E2E8F0; \}/u);
    assert.match(html, /\.prose-color-2 \{ background: rgb\(0, 0, 0\); \}/u);
    assert.match(
      html,
      /\.prose-color-3 \{ background: hsl\(210 40% 96% \/ 0\.5\); \}/u,
    );
    assert.match(html, /\.prose-color-4 \{ background: #fff; \}/u);
    // A repeated color reuses its class.
    assert.doesNotMatch(html, /prose-color-5/u);
    assert.doesNotMatch(html, /style="/u);
  });

  it("skips colors in code, links and other words", () => {
    const html = render(
      [
        "# Title",
        "",
        "Inline `#123456` and [#abcdef](https://example.com/#fedcba).",
        "See https://example.com/page#beef or abc#fff, #12345, #fffg and #ff-ff.",
        "",
        "```css",
        "color: #ff0000;",
        "```",
        "",
      ].join("\n"),
    );
    assert.doesNotMatch(html, /class="inline-swatch/u);
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
      report: null,
      text: "# Hi",
    });
    assert.match(html, /Unable to parse/u);
  });
});

describe("relativeImagePath", () => {
  it("decodes relative and root-relative paths", () => {
    assert.deepEqual(relativeImagePath("./img/my%20logo.png?v=2#x"), {
      path: "./img/my logo.png",
      rootRelative: false,
    });
    assert.deepEqual(relativeImagePath("/media/icon.png"), {
      path: "/media/icon.png",
      rootRelative: true,
    });
  });

  it("leaves URLs with a scheme, protocol-relative URLs and anchors alone", () => {
    for (const src of [
      "https://example.com/a.png",
      "data:image/png;base64,AA==",
      "vscode-resource:/a.png",
      "//cdn.example.com/a.png",
      "#top",
      "",
      "%E0%A4%A",
    ]) {
      assert.equal(relativeImagePath(src), null, src);
    }
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

  it("builds an SVG swatch data URI for a hex color", () => {
    const uri = swatchDataUri("#00000080");
    assert.ok(uri.startsWith("data:image/svg+xml,"));
    const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
    assert.match(svg, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg'/u);
    assert.match(svg, /fill='#00000080'/u);
    assert.doesNotMatch(uri, /[\s#()]/u);
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
