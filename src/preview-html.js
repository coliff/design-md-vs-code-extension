"use strict";

const MarkdownIt = require("markdown-it");
const { describeValue, formatDimension } = require("./format");
const { localize } = require("./l10n");
const { getFrontMatter } = require("./locate");

const markdown = new MarkdownIt({ html: false, linkify: true });

const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog 0123456789";
const WHITE_LUMINANCE = 1;
const BLACK_LUMINANCE = 0;
const SEVERITY_CLASS = { error: "fail", info: "info", warning: "warn" };
const SEVERITY_ORDER = { error: 0, info: 2, warning: 1 };

const HTML_ESCAPES = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu;
/*
 * Hex, rgb() and hsl() colors in prose. The lookarounds skip parts of words,
 * entities and paths such as "abc#fff" or "page#top-1".
 */
const PROSE_COLOR =
  /(?<![\w#&/-])(?:#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])|(?:rgba?|hsla?)\((?:[\d\s.,/%+-]|deg|g?rad|turn|none){1,60}\))/giu;
const SWATCH_TOKEN = "design_md_color";

function escapeHtml(value) {
  return String(value).replaceAll(/["&'<>]/gu, (char) => HTML_ESCAPES[char]);
}

function cssColor(color) {
  return color?.type === "color" && HEX_COLOR.test(color.hex) ? color.hex : "";
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

/**
 * Sanitize a font family list and add a generic fallback, so a font that is
 * not installed falls back to sans-serif rather than the browser's serif.
 * @param {string | undefined} family
 * @returns {string}
 */
function cssFontFamily(family) {
  const safe = family ? family.replaceAll(/[^\w\s,'"-]/gu, "").trim() : "";
  if (!safe) {
    return "";
  }
  return /\b(?:sans-serif|serif|monospace|cursive|fantasy|system-ui)\s*$/iu.test(
    safe,
  )
    ? safe
    : `${safe}, sans-serif`;
}

function contrast(luminanceA, luminanceB) {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick black or white sample text, whichever reads better on the color.
 * @param {number} luminance
 * @returns {string}
 */
function readableText(luminance) {
  return contrast(luminance, 1) >= contrast(luminance, 0) ? "#fff" : "#000";
}

function typographyDeclarations(style) {
  return [
    style.fontFamily ? `font-family: ${cssFontFamily(style.fontFamily)};` : "",
    style.fontSize ? `font-size: ${cssDimension(style.fontSize)};` : "",
    Number.isFinite(style.fontWeight)
      ? `font-weight: ${style.fontWeight};`
      : "",
    style.lineHeight ? `line-height: ${cssDimension(style.lineHeight)};` : "",
    style.letterSpacing
      ? `letter-spacing: ${cssDimension(style.letterSpacing)};`
      : "",
  ].filter(Boolean);
}

function propertyList(entries) {
  const rows = entries
    .filter(([, value]) => value !== undefined && value !== "")
    .map(
      ([property, value]) =>
        `<tr><th scope="row">${escapeHtml(property)}</th><td><code>${escapeHtml(value)}</code></td></tr>`,
    )
    .join("");
  return rows ? `<table class="props">${rows}</table>` : "";
}

function parseErrorHtml() {
  const message = localize(
    "Unable to parse this document. See the Problems panel.",
  );
  return `<header><h1>DESIGN.md</h1><p class="badge fail">${escapeHtml(message)}</p></header>`;
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
  return localize("Fail");
}

/**
 * Show a ratio truncated to two decimals. WCAG thresholds are not rounded, so
 * rounding 4.496 up to "4.50" would sit next to a failing AA grade.
 * @param {number} ratio
 * @returns {string}
 */
function formatRatio(ratio) {
  // The epsilon keeps float error from turning e.g. 4.57 into 4.56.
  return (Math.floor(ratio * 100 + 1e-9) / 100).toFixed(2);
}

function contrastBadge(label, ratio) {
  const grade = wcagGrade(ratio);
  const passClass = ratio >= 4.5 ? "pass" : "fail";
  return `<span class="badge ${passClass}" title="${escapeHtml(label)}">${escapeHtml(label)} ${formatRatio(ratio)} ${escapeHtml(grade)}</span>`;
}

function section(title, body, count) {
  if (!body) {
    return "";
  }
  const counter =
    count === undefined ? "" : ` <span class="count">${count}</span>`;
  return `<section class="card"><h2>${escapeHtml(title)}${counter}</h2>${body}</section>`;
}

function renderColors(colors, rules, { contrastBadges }) {
  let index = 0;
  const items = [];
  for (const [name, color] of colors) {
    const className = `color-${index}`;
    index += 1;
    const hex = cssColor(color);
    if (hex) {
      rules.push(
        `.${className} { background: ${hex}; color: ${readableText(color.luminance)}; }`,
      );
    }
    const badges = contrastBadges
      ? `<div class="badges">${contrastBadge(localize("on white"), contrast(color.luminance, WHITE_LUMINANCE))}${contrastBadge(localize("on black"), contrast(color.luminance, BLACK_LUMINANCE))}</div>`
      : "";
    items.push(`<li class="swatch">
  <div class="chip ${className}" aria-hidden="true">Aa</div>
  <div class="meta"><strong>${escapeHtml(name)}</strong><code>${escapeHtml(color.hex)}</code></div>
  ${badges}
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
    rules.push(`.${className} { ${typographyDeclarations(style).join(" ")} }`);
    const properties = propertyList([
      ["fontFamily", style.fontFamily],
      ["fontSize", formatDimension(style.fontSize)],
      ["fontWeight", style.fontWeight],
      ["lineHeight", formatDimension(style.lineHeight)],
      ["letterSpacing", formatDimension(style.letterSpacing)],
    ]);
    items.push(`<li>
  <div class="type-meta"><strong>${escapeHtml(name)}</strong>${properties}</div>
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

/**
 * Turn a token name such as "button-primary" into "Button Primary".
 * @param {string} name
 * @returns {string}
 */
function displayName(name) {
  return name
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function colorDeclarations(properties) {
  const declarations = [];
  const color = (key) => cssColor(properties.get(key));
  const background = color("backgroundColor");
  if (background) {
    declarations.push(`background: ${background};`);
  }
  if (color("textColor")) {
    declarations.push(`color: ${color("textColor")};`);
  } else if (/^#(?:[\da-f]{3}|[\da-f]{6})$/iu.test(background)) {
    // Without a text color, keep the label readable on an opaque fill.
    const { luminance } = properties.get("backgroundColor");
    declarations.push(`color: ${readableText(luminance)};`);
  }
  if (color("borderColor")) {
    declarations.push(`border: 1px solid ${color("borderColor")};`);
  }
  return declarations;
}

function componentDeclarations(properties) {
  const declarations = colorDeclarations(properties);
  const dimension = (key) => cssDimension(properties.get(key));
  const typography = properties.get("typography");
  if (typography?.type === "typography") {
    declarations.push(...typographyDeclarations(typography));
  }
  for (const [key, property] of [
    ["rounded", "border-radius"],
    ["padding", "padding"],
    ["height", "min-height"],
    ["width", "min-width"],
  ]) {
    if (dimension(key)) {
      declarations.push(`${property}: ${dimension(key)};`);
    }
  }
  return declarations;
}

function renderComponents(components, rules) {
  let index = 0;
  const items = [];
  for (const [name, component] of components) {
    const className = `component-${index}`;
    index += 1;
    rules.push(
      `.${className} { ${componentDeclarations(component.properties).join(" ")} }`,
    );
    const properties = propertyList(
      [...component.properties].map(([property, value]) => [
        property,
        describeValue(value),
      ]),
    );
    items.push(`<li class="component">
  <div class="stage"><span class="component-sample ${className}">${escapeHtml(displayName(name))}</span></div>
  <div class="component-meta"><strong>${escapeHtml(name)}</strong>${properties}</div>
</li>`);
  }
  return items.length > 0
    ? `<ul class="components">${items.join("")}</ul>`
    : "";
}

function lineOf(text, offset) {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
    }
  }
  return line;
}

function severityLabel(severity) {
  if (severity === "error") {
    return localize("Error");
  }
  if (severity === "warning") {
    return localize("Warning");
  }
  return localize("Info");
}

function countBadge(className, count, label) {
  return count > 0
    ? `<span class="badge ${className}">${escapeHtml(label)}</span>`
    : "";
}

function renderCounts({ errors, warnings, infos }) {
  // Literal strings in each call keep the l10n bundle keys easy to find.
  const badges = [
    countBadge(
      "fail",
      errors,
      errors === 1 ? localize("1 error") : localize("{0} errors", errors),
    ),
    countBadge(
      "warn",
      warnings,
      warnings === 1
        ? localize("1 warning")
        : localize("{0} warnings", warnings),
    ),
    countBadge(
      "info",
      infos,
      infos === 1 ? localize("1 info") : localize("{0} info", infos),
    ),
  ].join("");
  return badges ? ` <span class="counts">${badges}</span>` : "";
}

/**
 * Lint results, shown at the bottom of the preview.
 * @param {import("./analyze").Problem[]} problems
 * @param {string} text Document content, to turn offsets into line numbers.
 * @returns {string}
 */
function renderLintResults(problems, text) {
  const count = (severity) =>
    problems.filter((problem) => problem.severity === severity).length;
  const summary = {
    errors: count("error"),
    infos: count("info"),
    warnings: count("warning"),
  };
  const sorted = problems.toSorted(
    (first, second) =>
      SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity] ||
      first.start - second.start,
  );
  const body =
    sorted.length > 0
      ? `<ul class="problems">${sorted
          .map(
            (problem) =>
              `<li><span class="badge ${SEVERITY_CLASS[problem.severity] ?? "info"}">${escapeHtml(severityLabel(problem.severity))}</span><span class="message">${escapeHtml(problem.message)}</span><span class="location">${escapeHtml(localize("Line {0}", lineOf(text, problem.start)))}</span></li>`,
          )
          .join("")}</ul>`
      : `<p class="no-problems">${escapeHtml(localize("No problems found."))}</p>`;
  return `<section class="card lint"><h2>${escapeHtml(localize("Lint results"))}${renderCounts(summary)}</h2>${body}</section>`;
}

function renderReport(report, rules, options) {
  const system = report.designSystem;
  return [
    `<header><h1>${escapeHtml(system.name ?? "DESIGN.md")}</h1>`,
    system.description
      ? `<p class="description">${escapeHtml(system.description)}</p>`
      : "",
    "</header>",
    section(
      localize("Colors"),
      renderColors(system.colors, rules, options),
      system.colors.size,
    ),
    section(
      localize("Typography"),
      renderTypography(system.typography, rules),
      system.typography.size,
    ),
    section(
      localize("Spacing"),
      renderScale(system.spacing, "spacing", rules),
      system.spacing.size,
    ),
    section(
      localize("Rounded"),
      renderScale(system.rounded, "rounded", rules),
      system.rounded.size,
    ),
    section(
      localize("Components"),
      renderComponents(system.components, rules),
      system.components.size,
    ),
  ].join("\n");
}

/**
 * Split a text token so each color in it becomes a swatch token.
 * @param {import("markdown-it").Token} token
 * @param {import("markdown-it").StateCore} state
 * @returns {import("markdown-it").Token[]}
 */
function splitColors(token, state) {
  const tokens = [];
  let last = 0;
  for (const match of token.content.matchAll(PROSE_COLOR)) {
    const text = new state.Token("text", "", 0);
    text.content = token.content.slice(last, match.index);
    const swatch = new state.Token(SWATCH_TOKEN, "", 0);
    [swatch.content] = match;
    tokens.push(text, swatch);
    last = match.index + match[0].length;
  }
  if (last === 0) {
    return [token];
  }
  const rest = new state.Token("text", "", 0);
  rest.content = token.content.slice(last);
  tokens.push(rest);
  return tokens;
}

/**
 * Add swatches to plain text, leaving code spans, code blocks and links
 * (including linkified URLs) alone.
 * @param {import("markdown-it").StateCore} state
 */
function addProseSwatches(state) {
  for (const block of state.tokens) {
    if (block.type === "inline" && block.children) {
      let linkDepth = 0;
      block.children = block.children.flatMap((token) => {
        if (token.type === "link_open") {
          linkDepth += 1;
        } else if (token.type === "link_close") {
          linkDepth -= 1;
        }
        return token.type === "text" && linkDepth === 0
          ? splitColors(token, state)
          : [token];
      });
    }
  }
}

/**
 * The preview CSP blocks inline styles, so each distinct color gets a class
 * whose rule is added to the nonce-locked stylesheet.
 */
markdown.core.ruler.push("design_md_prose_swatches", addProseSwatches);
markdown.renderer.rules[SWATCH_TOKEN] = (...args) => {
  const [tokens, index, , env] = args;
  const { content } = tokens[index];
  if (!env.swatches.has(content)) {
    env.swatches.set(content, `prose-color-${env.swatches.size}`);
  }
  return `<span class="prose-color"><span class="inline-swatch ${env.swatches.get(content)}" aria-hidden="true"></span>${escapeHtml(content)}</span>`;
};

function renderProse(text, rules) {
  const frontMatter = getFrontMatter(text);
  const env = { swatches: new Map() };
  const prose = markdown.render(
    frontMatter ? text.slice(frontMatter.end) : text,
    env,
  );
  for (const [color, className] of env.swatches) {
    rules.push(`.${className} { background: ${color}; }`);
  }
  return prose.trim() ? `<section class="card prose">${prose}</section>` : "";
}

/**
 * Build the preview webview HTML for a DESIGN.md document.
 * @param {object} options
 * @param {string} options.text Raw document content.
 * @param {import("@google/design.md/linter").LintReport | null} options.report
 * @param {import("./analyze").Problem[]} [options.problems] Lint problems
 * listed at the bottom of the preview.
 * @param {boolean} [options.contrastBadges] Show the on-white and on-black
 * contrast badges under each color. Defaults to false.
 * @param {string} options.css Stylesheet contents.
 * @param {string} options.nonce CSP nonce for the inline stylesheet.
 * @param {string} options.cspSource Webview CSP source.
 * @param {string} [options.lang] VS Code display language for the `lang`
 * attribute. Defaults to "en".
 * @returns {string}
 */
function buildPreviewHtml({
  text,
  report,
  problems = [],
  contrastBadges = false,
  css,
  nonce,
  cspSource,
  lang = "en",
}) {
  const rules = [];
  const body = report
    ? renderReport(report, rules, { contrastBadges })
    : parseErrorHtml();
  const prose = renderProse(text, rules);
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; img-src ${cspSource} https: data:; font-src ${cspSource} https:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(localize("DESIGN.md Preview"))}</title>
<style nonce="${nonce}">
${css}
${rules.join("\n")}
</style>
</head>
<body>
<main>
${body}
${prose}
${renderLintResults(problems, text)}
</main>
</body>
</html>`;
}

module.exports = { buildPreviewHtml, escapeHtml };
