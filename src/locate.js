"use strict";

const { isMap, isScalar, parseDocument } = require("yaml");

const FRONT_MATTER = /^---\r?\n(?<body>[\s\S]*?)^---[ \t]*$/mu;
const REFERENCE = /\{(?<path>[\w-]+(?:\.[\w-]+)+)\}/gu;
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu;
const SECTION_NAME = /Section '(?<name>[^']+)'/u;

/**
 * Locate the YAML front matter block.
 * @param {string} text
 * @returns {{ start: number, end: number, body: string, bodyStart: number } | null}
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

function locateHeading(text, name) {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  const heading = new RegExp(
    String.raw`^#{1,6}[ \t]+(?<title>${escaped})[ \t]*$`,
    "mu",
  );
  const match = heading.exec(text);
  if (!match) {
    return null;
  }
  const start = match.index + match[0].indexOf(match.groups.title);
  return { start, end: start + name.length };
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
  const section = SECTION_NAME.exec(finding.message);
  if (section) {
    const heading = locateHeading(text, section.groups.name);
    if (heading) {
      return heading;
    }
  }
  return fallbackRange(text);
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
 * List hex color values defined under the `colors` key.
 * @param {string} text
 * @returns {Array<{ start: number, end: number, hex: string }>}
 */
function findColorValues(text) {
  const parsed = parseFrontMatter(text);
  if (!parsed) {
    return [];
  }
  const { doc, frontMatter } = parsed;
  const colors = findPair(doc.contents, "colors");
  if (!colors || !isMap(colors.value)) {
    return [];
  }
  const results = [];
  for (const pair of colors.value.items) {
    const { value } = pair;
    if (
      isScalar(value) &&
      typeof value.value === "string" &&
      HEX_COLOR.test(value.value)
    ) {
      const raw = frontMatter.body.slice(value.range[0], value.range[1]);
      const offset = raw.indexOf(value.value);
      const start = frontMatter.bodyStart + value.range[0] + offset;
      results.push({
        start,
        end: start + value.value.length,
        hex: value.value,
      });
    }
  }
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
    offset < frontMatter.end - 3
  );
}

module.exports = {
  findColorValues,
  getFrontMatter,
  isInFrontMatter,
  locateFinding,
  locatePath,
  referenceAt,
};
