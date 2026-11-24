"use strict";

const MarkdownIt = require("markdown-it");
const { isMap, isScalar, parseDocument, visit } = require("yaml");

const FRONT_MATTER = /^---[ \t]*\r?\n(?<body>[\s\S]*?)^---[ \t]*$/mu;
const REFERENCE = /\{(?<path>[\w-]+(?:\.[\w-]+)+)\}/gu;
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu;
const SECTION_ORDER =
  /^Section '(?<current>.+?)' appears before '(?<next>.+?)'(?:,|$)/u;
const DUPLICATE_SECTION =
  /^Section '(?<key>.+?)' is defined in both .+ and code block (?<block>\d+)\.$/u;

/**
 * Section headings the spec accepts in place of a canonical name, copied from
 * the upstream `spec-config.yaml`. Section-order messages only use canonical
 * names. A test checks this stays in sync with the installed linter.
 */
const SECTION_ALIASES = new Map([
  ["Brand & Style", "Overview"],
  ["Elevation", "Elevation & Depth"],
  ["Layout & Spacing", "Layout"],
]);

const markdown = new MarkdownIt();

/**
 * Locate the YAML front matter block.
 * @param {string} text
 * @returns {{ start: number, end: number, body: string, bodyStart: number, bodyEnd: number } | null}
 */
function getFrontMatter(text) {
  const match = FRONT_MATTER.exec(text);
  if (!match || match.index !== 0) {
    return null;
  }
  const bodyStart = match[0].indexOf("\n") + 1;
  return {
    start: 0,
    end: match[0].length,
    body: match.groups.body,
    bodyStart,
    bodyEnd: bodyStart + match.groups.body.length,
  };
}

function parseFrontMatter(text) {
  const frontMatter = getFrontMatter(text);
  if (!frontMatter) {
    return null;
  }
  const doc = parseDocument(frontMatter.body, { keepSourceTokens: false });
  return { doc, frontMatter };
}

function findPair(map, key) {
  if (!isMap(map)) {
    return undefined;
  }
  return map.items.find(
    (pair) => isScalar(pair.key) && String(pair.key.value) === key,
  );
}

/**
 * Find the YAML pair for a dotted token path such as `colors.primary`.
 * Returns offsets for the key and for the whole pair (key through value).
 * @param {string} text
 * @param {string} path
 * @returns {{ keyStart: number, keyEnd: number, pairEnd: number } | null}
 */
function locatePath(text, path) {
  const parsed = parseFrontMatter(text);
  if (!parsed) {
    return null;
  }
  const { doc, frontMatter } = parsed;
  let node = doc.contents;
  let pair = null;
  for (const segment of path.split(".")) {
    pair = findPair(node, segment);
    if (!pair) {
      return null;
    }
    node = pair.value;
  }
  const [keyStart, keyEnd] = pair.key.range;
  const pairEnd = pair.value?.range ? pair.value.range[1] : keyEnd;
  return {
    keyStart: frontMatter.bodyStart + keyStart,
    keyEnd: frontMatter.bodyStart + keyEnd,
    pairEnd: frontMatter.bodyStart + pairEnd,
  };
}

function lineStarts(text) {
  const starts = [0];
  for (let index = text.indexOf("\n"); index !== -1;) {
    starts.push(index + 1);
    index = text.indexOf("\n", index + 1);
  }
  return starts;
}

/**
 * Parse the Markdown after the front matter, so YAML comments and fenced code
 * are never mistaken for headings.
 * @param {string} text
 * @returns {{ tokens: import("markdown-it").Token[], firstLine: number, starts: number[] }}
 */
function parseBody(text) {
  const frontMatter = getFrontMatter(text);
  const offset = frontMatter ? frontMatter.end : 0;
  return {
    firstLine: text.slice(0, offset).split("\n").length - 1,
    starts: lineStarts(text),
    tokens: markdown.parse(text.slice(offset), {}),
  };
}

function lineRange(text, starts, line) {
  const start = starts[line] ?? text.length;
  const next = starts[line + 1];
  const end = next === undefined ? text.length : next - 1;
  return { start, text: text.slice(start, end) };
}

/**
 * List the level-2 headings the linter treats as sections, with each title
 * resolved to its canonical section name.
 * @param {string} text
 * @returns {Array<{ section: string, start: number, end: number }>}
 */
function sectionHeadings(text) {
  const { firstLine, starts, tokens } = parseBody(text);
  const headings = [];
  tokens.forEach((token, index) => {
    if (token.type !== "heading_open" || token.tag !== "h2" || !token.map) {
      return;
    }
    const title = tokens[index + 1].content.trim();
    const line = lineRange(text, starts, firstLine + token.map[0]);
    const column = line.text.indexOf(title);
    if (!title || column === -1) {
      return;
    }
    const start = line.start + column;
    headings.push({
      end: start + title.length,
      section: SECTION_ALIASES.get(title) ?? title,
      start,
    });
  });
  return headings;
}

/**
 * Find the heading a section-order finding is about: the first `current`
 * section that is directly followed (ignoring unknown sections) by `next`.
 */
function locateSectionOrder(text, { current, next }, known) {
  const headings = sectionHeadings(text).filter(
    (heading) => !known || known.has(heading.section),
  );
  const index = headings.findIndex(
    (heading, position) =>
      heading.section === current && headings[position + 1]?.section === next,
  );
  const heading =
    headings[index] ?? headings.find((item) => item.section === current);
  return heading ? { start: heading.start, end: heading.end } : null;
}

/**
 * Find a top-level key inside the given fenced YAML code block (1-based, the
 * same numbering the linter uses in its message).
 */
function locateCodeBlockKey(text, { block, key }) {
  const { firstLine, starts, tokens } = parseBody(text);
  const fences = tokens.filter(
    (token) =>
      token.type === "fence" &&
      ["yaml", "yml"].includes(token.info.trim().split(/\s+/u)[0]),
  );
  const fence = fences[Number(block) - 1];
  if (!fence?.map) {
    return null;
  }
  const escaped = key.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  const pattern = new RegExp(
    String.raw`^(?<quote>["']?)${escaped}\k<quote>[ \t]*:`,
    "u",
  );
  const [open, close] = fence.map;
  for (let line = open + 1; line < close; line += 1) {
    const { start, text: content } = lineRange(text, starts, firstLine + line);
    const match = pattern.exec(content);
    if (match) {
      return { start, end: start + match[0].replace(/[ \t]*:$/u, "").length };
    }
  }
  const { start, text: opening } = lineRange(text, starts, firstLine + open);
  return { start, end: start + opening.trimEnd().length };
}

function fallbackRange(text) {
  if (getFrontMatter(text)) {
    return { start: 0, end: 3 };
  }
  const firstLineEnd = text.search(/\r?\n/u);
  return { start: 0, end: firstLineEnd === -1 ? text.length : firstLineEnd };
}

function locateReference(text, location, message) {
  const ref = new RegExp(REFERENCE.source, "u").exec(message);
  if (ref) {
    const index = text
      .slice(location.keyStart, location.pairEnd)
      .indexOf(ref[0]);
    if (index !== -1) {
      const start = location.keyStart + index;
      return { start, end: start + ref[0].length };
    }
  }
  return { start: location.keyStart, end: location.keyEnd };
}

/**
 * The canonical section names, read from the "Expected order" list that
 * section-order messages end with.
 * @param {{ message: string }} finding
 * @returns {Set<string> | null}
 */
function knownSections(finding) {
  const [, order] = finding.message.split("Expected order: ");
  return order ? new Set(order.split(", ")) : null;
}

/**
 * Map a linter finding to a text range.
 * @param {string} text
 * @param {{ path?: string, message: string, rule?: string }} finding
 * @returns {{ start: number, end: number }}
 */
function locateFinding(text, finding) {
  const location = finding.path && locatePath(text, finding.path);
  if (location) {
    return locateReference(text, location, finding.message);
  }
  const order = SECTION_ORDER.exec(finding.message);
  const duplicate = DUPLICATE_SECTION.exec(finding.message);
  const range =
    (order && locateSectionOrder(text, order.groups, knownSections(finding))) ||
    (duplicate && locateCodeBlockKey(text, duplicate.groups));
  return range || fallbackRange(text);
}

/**
 * Find the `{section.token}` reference that contains the given offset.
 * @param {string} text
 * @param {number} offset
 * @returns {{ path: string, start: number, end: number } | null}
 */
function referenceAt(text, offset) {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const nextNewline = text.indexOf("\n", offset);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const line = text.slice(lineStart, lineEnd);
  for (const match of line.matchAll(REFERENCE)) {
    const start = lineStart + match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      return { path: match.groups.path, start, end };
    }
  }
  return null;
}

/**
 * List hex color values anywhere in the front matter, including nested
 * component properties such as `components.button.backgroundColor`.
 * @param {string} text
 * @returns {Array<{ start: number, end: number, hex: string }>}
 */
function findColorValues(text) {
  const parsed = parseFrontMatter(text);
  if (!parsed) {
    return [];
  }
  const { doc, frontMatter } = parsed;
  const results = [];
  visit(doc, {
    Scalar(key, node) {
      if (
        key === "key" ||
        typeof node.value !== "string" ||
        !HEX_COLOR.test(node.value) ||
        !node.range
      ) {
        return;
      }
      const raw = frontMatter.body.slice(node.range[0], node.range[1]);
      const start =
        frontMatter.bodyStart + node.range[0] + raw.indexOf(node.value);
      results.push({ start, end: start + node.value.length, hex: node.value });
    },
  });
  return results;
}

/**
 * Whether an offset falls inside the YAML front matter body.
 * @param {string} text
 * @param {number} offset
 * @returns {boolean}
 */
function isInFrontMatter(text, offset) {
  const frontMatter = getFrontMatter(text);
  return (
    Boolean(frontMatter) &&
    offset >= frontMatter.bodyStart &&
    offset < frontMatter.bodyEnd
  );
}

module.exports = {
  SECTION_ALIASES,
  findColorValues,
  getFrontMatter,
  isInFrontMatter,
  locateFinding,
  locatePath,
  referenceAt,
};
