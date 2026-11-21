"use strict";

const { fixSectionOrder, lint } = require("./linter.mjs");
const { locateFinding } = require("./locate");

const CACHE_SIZE = 8;
const cache = new Map();

/**
 * @typedef {object} Problem
 * @property {number} start
 * @property {number} end
 * @property {"error" | "warning" | "info"} severity
 * @property {string} message
 * @property {string | undefined} rule
 */

/**
 * Lint DESIGN.md content and locate each finding in the text.
 * Results are cached by content so providers can share one lint run.
 * @param {string} text
 * @returns {{ report: import("@google/design.md/linter").LintReport | undefined, problems: Problem[] }}
 */
function analyze(text) {
  const cached = cache.get(text);
  if (cached) {
    return cached;
  }
  const result = runLint(text);
  cache.set(text, result);
  if (cache.size > CACHE_SIZE) {
    cache.delete(cache.keys().next().value);
  }
  return result;
}

function runLint(text) {
  try {
    const report = lint(text);
    const problems = report.findings.map((finding) => ({
      ...locateFinding(text, finding),
      severity: finding.severity,
      message: finding.message,
      rule: finding.rule,
    }));
    return { report, problems };
  } catch (error) {
    return {
      report: undefined,
      problems: [
        {
          start: 0,
          end: 0,
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
          rule: "parse-error",
        },
      ],
    };
  }
}

/**
 * Reorder the markdown sections into the spec's canonical order.
 * @param {string} text
 * @returns {string | undefined} The fixed content, or undefined if nothing can be fixed.
 */
function fixSectionOrderText(text) {
  const { report } = analyze(text);
  if (!report) {
    return undefined;
  }
  const result = fixSectionOrder({
    content: text,
    sections: report.documentSections,
  });
  return !result.success || result.fixedContent === text
    ? undefined
    : result.fixedContent;
}

/**
 * Whether a document should be treated as a DESIGN.md file.
 * @param {{ languageId: string, fileName: string }} document
 * @returns {boolean}
 */
function isDesignDocument(document) {
  return (
    document.languageId === "markdown" &&
    /(?:^|[\\/])DESIGN\.md$/u.test(document.fileName)
  );
}

module.exports = { analyze, fixSectionOrderText, isDesignDocument };
