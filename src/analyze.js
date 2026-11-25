"use strict";

const {
  checkFrontMatter,
  isUpstreamDuplicateKey,
} = require("./frontmatter-rules");
const { locateFinding } = require("./locate");

let linter = null;

/**
 * Load the upstream linter on first use. It reads its spec config from disk
 * when it loads, so loading it at activation would stop the extension from
 * registering its commands if that file is missing.
 * @returns {typeof import("./linter.mjs")}
 */
function getLinter() {
  if (linter === null) {
    linter = require("./linter.mjs");
  }
  return linter;
}

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
 * @typedef {object} AnalyzeOptions
 * @property {boolean} [contrastRatio] Report contrast-ratio warnings. Defaults to true.
 */

/**
 * Lint DESIGN.md content and locate each finding in the text.
 * Lint runs are cached by content so providers can share one run; options
 * only filter the cached result.
 * @param {string} text
 * @param {AnalyzeOptions} [options]
 * @returns {{ report: import("@google/design.md/linter").LintReport | null, problems: Problem[], summary: Summary }}
 */
function analyze(text, { contrastRatio = true } = {}) {
  let result = cache.get(text);
  if (!result) {
    result = runLint(text);
    cache.set(text, result);
    if (cache.size > CACHE_SIZE) {
      cache.delete(cache.keys().next().value);
    }
  }
  if (contrastRatio) {
    return result;
  }
  const problems = result.problems.filter(
    (problem) => problem.rule !== "contrast-ratio",
  );
  return { ...result, problems, summary: summarize(problems) };
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
    return { report: getLinter().lint(text) };
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
  /*
   * The linter splits sections on "\n" and joins them with "\n", so CRLF
   * content would come back with mixed line endings. Fix it as LF and restore
   * the document's line endings afterwards.
   */
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const content = eol === "\n" ? text : text.replaceAll("\r\n", "\n");
  const { report } = analyze(content);
  if (!report) {
    return null;
  }
  const result = getLinter().fixSectionOrder({
    content,
    sections: report.documentSections,
  });
  if (!result.success || result.fixedContent === content) {
    return null;
  }
  return eol === "\n"
    ? result.fixedContent
    : result.fixedContent.replaceAll("\n", eol);
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

/*
 * Schemes whose documents are the user's own files. Others, such as the `git:`
 * copies VS Code opens for diffs and gutter indicators, would add a second,
 * stale set of problems to the Problems panel.
 */
const LINTABLE_SCHEMES = new Set(["file", "untitled", "vscode-remote"]);

/**
 * Whether a DESIGN.md document should get diagnostics.
 * @param {{ languageId: string, fileName: string, uri: { scheme: string } }} document
 * @returns {boolean}
 */
function isLintableDocument(document) {
  return (
    LINTABLE_SCHEMES.has(document.uri.scheme) && isDesignDocument(document)
  );
}

module.exports = {
  analyze,
  fixSectionOrderText,
  isDesignDocument,
  isLintableDocument,
};
