"use strict";

// Mirror esbuild's `--loader:.css=text` and `--loader:.md=text` so source files load under node:test.
const fs = require("node:fs");

for (const extension of [".css", ".md"]) {
  // eslint-disable-next-line n/no-deprecated-api -- Test-only loader hook; node:test has no stable alternative for CJS text imports.
  require.extensions[extension] = (module, filename) => {
    module._compile(
      `module.exports = ${JSON.stringify(fs.readFileSync(filename, "utf8"))};`,
      filename,
    );
  };
}
