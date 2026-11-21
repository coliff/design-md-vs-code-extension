"use strict";

// Mirror esbuild's `--loader:.css=text` and `--loader:.md=text` so source files load under node:test.
const fs = require("node:fs");

for (const extension of [".css", ".md"]) {
  require.extensions[extension] = (module, filename) => {
    module._compile(
      `module.exports = ${JSON.stringify(fs.readFileSync(filename, "utf8"))};`,
      filename,
    );
  };
}
