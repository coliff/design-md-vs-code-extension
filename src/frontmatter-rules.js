"use strict";

const { isMap, isScalar, isSeq, parseDocument } = require("yaml");
const { getFrontMatter } = require("./locate");

/**
 * The upstream linter reports duplicate keys as a generic YAML warning with no
 * rule or location, and stops linting the tokens. These checks replace it with
 * one located finding per duplicate key.
 */
const UPSTREAM_DUPLICATE_KEY = /^Map keys must be unique/u;

function lineOf(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function keyName(pair) {
  return isScalar(pair.key) ? String(pair.key.value) : null;
}

function recordKey(pair, scope) {
  const name = keyName(pair);
  if (name === null || !pair.key.range) {
    return;
  }
  const { path, problems, seen, text, toOffset } = scope;
  const start = toOffset(pair.key.range[0]);
  const first = seen.get(name);
  if (first === undefined) {
    seen.set(name, start);
    return;
  }
  const where = path ? `'${path}'` : "the front matter";
  problems.push({
    start,
    end: toOffset(pair.key.range[1]),
    severity: "error",
    message: `Duplicate key '${name}' in ${where}. It is already defined on line ${lineOf(text, first)}.`,
    rule: "duplicate-key",
  });
}

function childPathOf(path, pair) {
  const name = keyName(pair);
  if (name === null) {
    return path;
  }
  return path ? `${path}.${name}` : name;
}

function findDuplicateKeysIn(node, path, context) {
  if (isMap(node)) {
    findDuplicateKeys(node, path, context);
  } else if (isSeq(node)) {
    node.items.forEach((item, index) =>
      findDuplicateKeysIn(item, `${path}[${index}]`, context),
    );
  }
}

function findDuplicateKeys(map, path, context) {
  const scope = { ...context, path, seen: new Map() };
  for (const pair of map.items) {
    recordKey(pair, scope);
    findDuplicateKeysIn(pair.value, childPathOf(path, pair), context);
  }
}

function checkName(map, frontMatter, { nameDefinedElsewhere, problems }) {
  const pair = map?.items.find((item) => keyName(item) === "name");
  if (!pair) {
    if (nameDefinedElsewhere) {
      return;
    }
    problems.push({
      start: 0,
      end: 3,
      severity: "error",
      message:
        "Missing required 'name' field. Add a name for the design system to the front matter.",
      rule: "missing-name",
    });
    return;
  }
  const { value } = pair;
  if (
    !isScalar(value) ||
    typeof value.value !== "string" ||
    value.value.trim() === ""
  ) {
    const [start, end] = pair.key.range;
    problems.push({
      start: frontMatter.bodyStart + start,
      end: frontMatter.bodyStart + end,
      severity: "error",
      message: "The 'name' field must be a non-empty string.",
      rule: "missing-name",
    });
  }
}

/**
 * Check the YAML front matter for problems the upstream linter does not
 * report: a missing or empty `name`, and duplicate keys at any depth.
 * @param {string} text
 * @param {object} [options]
 * @param {boolean} [options.nameDefinedElsewhere] Whether `name` is set in a
 * fenced YAML block instead, so a front matter without it is not an error.
 * @returns {import("./analyze").Problem[]}
 */
function checkFrontMatter(text, { nameDefinedElsewhere = false } = {}) {
  const frontMatter = getFrontMatter(text);
  if (!frontMatter) {
    return [];
  }
  const doc = parseDocument(frontMatter.body, { uniqueKeys: false });
  if (doc.errors.length > 0) {
    return [];
  }
  const problems = [];
  if (doc.contents === null) {
    checkName(null, frontMatter, { nameDefinedElsewhere, problems });
    return problems;
  }
  if (!isMap(doc.contents)) {
    return [];
  }
  checkName(doc.contents, frontMatter, { nameDefinedElsewhere, problems });
  findDuplicateKeys(doc.contents, "", {
    problems,
    text,
    toOffset: (offset) => frontMatter.bodyStart + offset,
  });
  return problems;
}

/**
 * Whether an upstream finding is the generic duplicate-key YAML warning.
 * @param {{ message: string, rule?: string }} finding
 * @returns {boolean}
 */
function isUpstreamDuplicateKey(finding) {
  return !finding.rule && UPSTREAM_DUPLICATE_KEY.test(finding.message);
}

module.exports = { checkFrontMatter, isUpstreamDuplicateKey };
