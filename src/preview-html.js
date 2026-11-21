"use strict";

const MarkdownIt = require("markdown-it");
const { describeValue, formatDimension } = require("./format");
const { getFrontMatter } = require("./locate");

const markdown = new MarkdownIt({ html: false, linkify: true });

const HTML_ESCAPES = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog";
const WHITE_LUMINANCE = 1;
const BLACK_LUMINANCE = 0;
const PARSE_ERROR_HTML = `<header><h1>DESIGN.md</h1><p class="badge fail">Unable to parse this document. See the Problems panel.</p></header>`;

function escapeHtml(value) {
  return String(value).replaceAll(/["&'<>]/gu, (char) => HTML_ESCAPES[char]);
}

function cssDimension(dimension) {
  if (
    !dimension ||
    !Number.isFinite(dimension.value) ||
    !/^[a-z%]*$/iu.test(dimension.unit)
  ) {
    return "";
  }
  return formatDimension(dimension);
}

function cssFontFamily(family) {
  return family ? family.replaceAll(/[^\w\s,'"-]/gu, "") : "";
}

function contrast(luminanceA, luminanceB) {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagGrade(ratio) {
  if (ratio >= 7) {
    return "AAA";
  }
  if (ratio >= 4.5) {
    return "AA";
  }
  if (ratio >= 3) {
    return "AA Large";
  }
  return "Fail";
}

function contrastBadge(label, ratio) {
  const grade = wcagGrade(ratio);
  const passClass = ratio >= 4.5 ? "pass" : "fail";
  return `<span class="badge ${passClass}" title="${escapeHtml(label)}">${escapeHtml(label)} ${ratio.toFixed(2)} ${grade}</span>`;
}

function section(title, body) {
  return body ? `<section><h2>${escapeHtml(title)}</h2>${body}</section>` : "";
}

function renderColors(colors, rules) {
  let index = 0;
  const items = [];
  for (const [name, color] of colors) {
    const className = `color-${index}`;
    index += 1;
    rules.push(`.${className} { background: ${color.hex}; }`);
    items.push(`<li class="swatch">
  <div class="chip ${className}"></div>
  <div class="meta"><strong>${escapeHtml(name)}</strong><code>${escapeHtml(color.hex)}</code></div>
  <div class="badges">${contrastBadge("on white", contrast(color.luminance, WHITE_LUMINANCE))}${contrastBadge("on black", contrast(color.luminance, BLACK_LUMINANCE))}</div>
</li>`);
  }
  return items.length > 0 ? `<ul class="swatches">${items.join("")}</ul>` : "";
}

function renderTypography(typography, rules) {
  let index = 0;
  const items = [];
  for (const [name, style] of typography) {
    const className = `type-${index}`;
    index += 1;
    const declarations = [
      style.fontFamily
        ? `font-family: ${cssFontFamily(style.fontFamily)};`
        : "",
      style.fontSize ? `font-size: ${cssDimension(style.fontSize)};` : "",
      Number.isFinite(style.fontWeight)
        ? `font-weight: ${style.fontWeight};`
        : "",
      style.lineHeight ? `line-height: ${cssDimension(style.lineHeight)};` : "",
      style.letterSpacing
        ? `letter-spacing: ${cssDimension(style.letterSpacing)};`
        : "",
    ].join(" ");
    rules.push(`.${className} { ${declarations} }`);
    items.push(`<li>
  <div class="meta"><strong>${escapeHtml(name)}</strong><code>${escapeHtml(describeValue(style))}</code></div>
  <p class="sample ${className}">${SAMPLE_TEXT}</p>
</li>`);
  }
  return items.length > 0
    ? `<ul class="type-scale">${items.join("")}</ul>`
    : "";
}

function renderScale(scale, kind, rules) {
  let index = 0;
  const items = [];
  for (const [name, dimension] of scale) {
    const className = `${kind}-${index}`;
    index += 1;
    const value = cssDimension(dimension);
    rules.push(
      kind === "spacing"
        ? `.${className} { width: ${value}; }`
        : `.${className} { border-radius: ${value}; }`,
    );
    items.push(`<li>
  <div class="${kind}-demo ${className}"></div>
  <div class="meta"><strong>${escapeHtml(name)}</strong><code>${escapeHtml(value)}</code></div>
</li>`);
  }
  return items.length > 0
    ? `<ul class="scale ${kind}">${items.join("")}</ul>`
    : "";
}

function renderComponents(components) {
  const items = [];
  for (const [name, component] of components) {
    const rows = [...component.properties]
      .map(
        ([property, value]) =>
          `<tr><th scope="row">${escapeHtml(property)}</th><td><code>${escapeHtml(describeValue(value))}</code></td></tr>`,
      )
      .join("");
    items.push(
      `<details open><summary>${escapeHtml(name)}</summary><table>${rows}</table></details>`,
    );
  }
  return items.join("");
}

function renderSummary(report) {
  const { errors, warnings, infos } = report.summary;
  return `<p class="summary">
  <span class="badge ${errors > 0 ? "fail" : "pass"}">${errors} errors</span>
  <span class="badge ${warnings > 0 ? "warn" : "pass"}">${warnings} warnings</span>
  <span class="badge">${infos} info</span>
</p>`;
}

function renderReport(report, rules) {
  const system = report.designSystem;
  return [
    `<header><h1>${escapeHtml(system.name ?? "DESIGN.md")}</h1>`,
    system.description
      ? `<p class="description">${escapeHtml(system.description)}</p>`
      : "",
    renderSummary(report),
    "</header>",
    section("Colors", renderColors(system.colors, rules)),
    section("Typography", renderTypography(system.typography, rules)),
    section("Spacing", renderScale(system.spacing, "spacing", rules)),
    section("Rounded", renderScale(system.rounded, "rounded", rules)),
    section("Components", renderComponents(system.components)),
  ].join("\n");
}

/**
 * Build the preview webview HTML for a DESIGN.md document.
 * @param {object} options
 * @param {string} options.text Raw document content.
 * @param {import("@google/design.md/linter").LintReport | null} options.report
 * @param {string} options.css Stylesheet contents.
 * @param {string} options.nonce CSP nonce for the inline stylesheet.
 * @param {string} options.cspSource Webview CSP source.
 * @returns {string}
 */
function buildPreviewHtml({ text, report, css, nonce, cspSource }) {
  const rules = [];
  const frontMatter = getFrontMatter(text);
  const prose = markdown.render(
    frontMatter ? text.slice(frontMatter.end) : text,
  );
  const body = report ? renderReport(report, rules) : PARSE_ERROR_HTML;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; img-src ${cspSource} https: data:; font-src ${cspSource} https:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DESIGN.md Preview</title>
<style nonce="${nonce}">
${css}
${rules.join("\n")}
</style>
</head>
<body>
<main>
${body}
<section class="prose">${prose}</section>
</main>
</body>
</html>`;
}

module.exports = { buildPreviewHtml, escapeHtml };
