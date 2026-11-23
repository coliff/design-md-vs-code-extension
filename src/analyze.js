"use strict";

const {
  checkFrontMatter,
  isUpstreamDuplicateKey,
} = require("./frontmatter-rules");
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
 * @typedef {object} Summary
 * @property {number} errors
 * @property {number} warnings
 * @property {number} infos
 */

/**
 * Lint DESIGN.md content and locate each finding in the text.
 * Results are cached by content so providers can share one lint run.
 * @param {string} text
 * @returns {{ report: import("@google/design.md/linter").LintReport | null, problems: Problem[], summary: Summary }}
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

function isReportedFinding(finding, hasDuplicates) {
  // The linter's token count is a summary, not something to fix.
  if (finding.rule === "token-summary") {
    return false;
  }
  return !(hasDuplicates && isUpstreamDuplicateKey(finding));
}

/**
 * Count problems by severity, so the preview matches the Problems panel.
 * @param {Problem[]} problems
 * @returns {Summary}
 */
function summarize(problems) {
  const count = (severity) =>
    problems.filter((problem) => problem.severity === severity).length;
  return {
    errors: count("error"),
    infos: count("info"),
    warnings: count("warning"),
  };
}

function lintText(text) {
  try {
    return { report: lint(text) };
  } catch (error) {
    return {
      error: {
        start: 0,
        end: 0,
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
        rule: "parse-error",
      },
      report: null,
    };
  }
}

function runLint(text) {
  const { error, report } = lintText(text);
  const extra = checkFrontMatter(text, {
    nameDefinedElsewhere: Boolean(report?.designSystem.name),
  });
  const hasDuplicates = extra.some(
    (problem) => problem.rule === "duplicate-key",
  );
  const located = report
    ? report.findings
        .filter((finding) => isReportedFinding(finding, hasDuplicates))
        .map((finding) => ({
          ...locateFinding(text, finding),
          severity: finding.severity,
          message: finding.message,
          rule: finding.rule,
        }))
    : [error];
  const problems = [...extra, ...located];
  return { problems, report, summary: summarize(problems) };
}

/**
 * Reorder the markdown sections into the spec's canonical order.
 * @param {string} text
 * @returns {string | null} The fixed content, or null if nothing can be fixed.
 */
function fixSectionOrderText(text) {
  const { report } = analyze(text);
  if (!report) {
    return null;
  }
  const result = fixSectionOrder({
    content: text,
    sections: report.documentSections,
  });
  if (!result.success || result.fixedContent === text) {
    return null;
  }
  return result.fixedContent;
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
