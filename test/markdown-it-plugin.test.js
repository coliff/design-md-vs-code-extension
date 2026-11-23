"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const MarkdownIt = require("markdown-it");
const {
  createMarkdownItPlugin,
  isDesignMd,
  renderFrontMatter,
} = require("../src/markdown-it-plugin");

const SOURCE = `---
name: Demo
colors:
  primary: "#1a73e8"
typography:
  body:
    fontFamily: Inter
---

# Hello
`;

/* eslint-disable camelcase, max-params */
// Mimic VS Code's built-in preview, which registers its front matter rule after extension plugins.
function vscodeFrontMatter(md) {
  md.block.ruler.before("fence", "front_matter", (state, line, end, silent) => {
    if (line !== 0 || state.src.slice(0, 4) !== "---\n") {
      return false;
    }
    let close = line + 1;
    while (
      close < end &&
      state.src.slice(state.bMarks[close], state.eMarks[close]) !== "---"
    ) {
      close += 1;
    }
    if (silent) {
      return true;
    }
    const token = state.push("front_matter", "", 0);
    token.map = [line, close + 1];
    token.meta = {
      content: state.src.slice(state.bMarks[line + 1], state.bMarks[close]),
    };
    state.line = close + 1;
    return true;
  });
  md.renderer.rules.front_matter = () => "<table>VS CODE</table>";
}

function vscodeSourceMap(md) {
  md.core.ruler.push("source_map_data_attribute", (state) => {
    for (const token of state.tokens) {
      if (token.map && token.type !== "inline") {
        token.attrSet("data-line", String(token.map[0]));
        token.attrJoin("class", "code-line");
        token.attrJoin("dir", "auto");
      }
    }
  });
}

function render(path, mode = "table") {
  const md = new MarkdownIt();
  createMarkdownItPlugin(() => mode)(md);
  vscodeFrontMatter(md);
  vscodeSourceMap(md);
  // VS Code tokenizes without the document URI and passes it only when rendering.
  const tokens = md.parse(SOURCE, { currentDocument: undefined });
  return md.renderer.render(tokens, md.options, {
    currentDocument: { path },
  });
}

describe("markdown-it plugin", () => {
  it("renders DESIGN.md front matter as nested tables with swatches", () => {
    const html = render("/work/DESIGN.md");
    assert.doesNotMatch(html, /VS CODE/u);
    assert.match(html, /class="frontmatter design-md-frontmatter code-line"/u);
    assert.match(html, /data-line="0"/u);
    assert.match(html, /dir="auto"/u);
    assert.match(html, /class="design-md-frontmatter-nested"/u);
    assert.match(html, /background-color: #1a73e8;/u);
    assert.match(html, /<th scope="row">fontFamily<\/th>/u);
    assert.match(html, /<h1[^>]*>Hello<\/h1>/u);
  });

  it("leaves other Markdown files and other modes to VS Code", () => {
    assert.match(render("/work/README.md"), /VS CODE/u);
    assert.match(render("/work/DESIGN.md", "codeBlock"), /VS CODE/u);
    assert.match(render("/work/DESIGN.md", "hide"), /VS CODE/u);
  });

  it("matches DESIGN.md paths only", () => {
    assert.ok(isDesignMd({ path: "/a/DESIGN.md" }));
    assert.ok(!isDesignMd({ path: "/a/MY-DESIGN.md" }));
    assert.ok(!isDesignMd(undefined));
  });

  it("escapes values and reports YAML errors", () => {
    assert.match(renderFrontMatter("name: <b>"), /&lt;b&gt;/u);
    assert.match(renderFrontMatter("a: [1"), /frontmatter-error/u);
  });

  it("previews hex, CSS colors, and color token references", () => {
    const html = renderFrontMatter(`colors:
  primary: "#1a73e8"
  mist: rgba(255, 255, 255, 0.1)
components:
  button:
    backgroundColor: "{colors.primary}"
    label: "{typography.body}"
name: Inter
`);
    assert.match(html, /background-color: #1a73e8;/u);
    assert.match(html, /background-color: rgba\(255, 255, 255, 0\.1\);/u);
    assert.match(html, /\{colors\.primary\}/u);
    assert.match(
      html,
      /<th scope="row">label<\/th><td><code>\{typography\.body\}<\/code><\/td>/u,
    );
    assert.match(
      html,
      /<th scope="row">name<\/th><td><code>Inter<\/code><\/td>/u,
    );
    assert.equal(html.match(/design-md-swatch/gu)?.length, 3);
  });

  it("ignores unsafe color-like strings and reference cycles", () => {
    const html = renderFrontMatter(`evil: "#fff;}</style>"
colors:
  a: "{colors.b}"
  b: "{colors.a}"
`);
    assert.doesNotMatch(html, /design-md-swatch/u);
    assert.match(html, /&lt;\/style&gt;/u);
  });
});
