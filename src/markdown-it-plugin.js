"use strict";

const { parse } = require("yaml");

const COLOR_LENGTH = 64;
const DESIGN_MD = /(?:^|[/\\])DESIGN\.md$/u;
const FRONT_MATTER_TOKEN = "front_matter";
const FUNCTION_COLOR = /^(?:rgba?|hsla?)\([0-9.%a-z\s,/]+\)$/iu;
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu;
const HTML_ESCAPES = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const RENDERED_TOKEN = "design_md_front_matter";
const TOKEN_REF = /^\{([a-z0-9_-]+(?:\.[a-z0-9_-]+)*)\}$/iu;

function escapeHtml(value) {
  return String(value).replaceAll(/["&'<>]/gu, (char) => HTML_ESCAPES[char]);
}

function isDesignMd(uri) {
  const target =
    uri?.path ?? uri?.fsPath ?? (typeof uri === "string" ? uri : "");
  return DESIGN_MD.test(target);
}

function cssColor(value) {
  if (value.length > COLOR_LENGTH) {
    return "";
  }
  return HEX_COLOR.test(value) || FUNCTION_COLOR.test(value) ? value : "";
}

function lookupPath(root, path) {
  let current = root;
  for (const key of path.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function resolveColor(root, value, seen) {
  const direct = typeof value === "string" ? cssColor(value) : "";
  if (direct) {
    return direct;
  }
  const match = typeof value === "string" ? TOKEN_REF.exec(value) : null;
  if (!match || seen.has(value)) {
    return "";
  }
  seen.add(value);
  const next = lookupPath(root, match[1]);
  return typeof next === "string" ? resolveColor(root, next, seen) : "";
}

function renderScalar(value, root) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = value instanceof Date ? value.toISOString() : String(value);
  const color = resolveColor(root, text, new Set());
  const swatch = color
    ? `<span aria-hidden="true" class="design-md-swatch" style="background-color: ${color};"></span>`
    : "";
  return `${swatch}<code>${escapeHtml(text)}</code>`;
}

function isRecord(value) {
  return (
    value !== null && typeof value === "object" && !(value instanceof Date)
  );
}

function renderValue(value, root) {
  if (Array.isArray(value)) {
    return value.length > 0
      ? `<ul>${value.map((item) => `<li>${renderValue(item, root)}</li>`).join("")}</ul>`
      : "";
  }
  return isRecord(value) ? renderTable(value, root) : renderScalar(value, root);
}

function renderRows(object, root) {
  return Object.entries(object)
    .map(
      ([key, value]) =>
        `<tr><th scope="row">${escapeHtml(key)}</th><td>${renderValue(value, root)}</td></tr>`,
    )
    .join("");
}

function addClasses(classes, value) {
  for (const item of value.split(/\s+/u)) {
    if (item && !classes.includes(item)) {
      classes.push(item);
    }
  }
}

function tableAttributes(token) {
  const classes = ["frontmatter", "design-md-frontmatter"];
  const extras = [];
  for (const [name, value] of token?.attrs ?? []) {
    if (name === "class") {
      addClasses(classes, value);
    } else if (name === "data-line" || name === "dir") {
      extras.push(`${name}="${escapeHtml(value)}"`);
    }
  }
  extras.sort();
  return [`class="${escapeHtml(classes.join(" "))}"`, ...extras].join(" ");
}

function renderTable(object, root) {
  const rows = renderRows(object, root);
  return rows
    ? `<table class="design-md-frontmatter-nested"><tbody>${rows}</tbody></table>`
    : "";
}

function renderRoot(data, token) {
  const rows = renderRows(data, data);
  return rows
    ? `<table ${tableAttributes(token)}><tbody>${rows}</tbody></table>`
    : "";
}

function parseYaml(source) {
  try {
    return { data: parse(source) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Render DESIGN.md YAML front matter as nested tables with color swatches.
 * @param {string} source YAML between the `---` fences.
 * @param {{ attrs?: Array<[string, string]> } | undefined} [token] Source-map
 * attributes from the Markdown token, when the preview provides them.
 * @returns {string}
 */
function renderFrontMatter(source, token) {
  const { data, error } = parseYaml(source);
  if (error) {
    return `<div class="frontmatter-error" role="alert"><pre>${escapeHtml(error)}</pre></div>
`;
  }
  if (!isRecord(data)) {
    return "";
  }
  const table = renderRoot(data, token);
  return table ? `${table}\n` : "";
}

/**
 * Create a markdown-it plugin for VS Code's built-in Markdown preview.
 * VS Code applies its own front matter renderer after extension plugins, so
 * DESIGN.md front matter tokens are retagged and rendered here instead.
 * @param {(uri: unknown) => string} getFrontMatterMode Returns the
 * `markdown.preview.frontMatter` setting for a document.
 * @returns {(md: import("markdown-it")) => import("markdown-it")}
 */
function createMarkdownItPlugin(getFrontMatterMode) {
  return (md) => {
    md.core.ruler.push("design_md_front_matter", (state) => {
      const uri = state.env?.currentDocument;
      if (!isDesignMd(uri) || getFrontMatterMode(uri) !== "table") {
        return;
      }
      for (const token of state.tokens) {
        if (token.type === FRONT_MATTER_TOKEN) {
          token.type = RENDERED_TOKEN;
        }
      }
    });
    md.renderer.rules[RENDERED_TOKEN] = (tokens, index) => {
      const token = tokens[index];
      return renderFrontMatter(token.meta?.content ?? token.content, token);
    };
    return md;
  };
}

module.exports = { createMarkdownItPlugin, isDesignMd, renderFrontMatter };
