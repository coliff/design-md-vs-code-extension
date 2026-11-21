import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const minify = process.argv.includes("--minify");

/** @type {import("esbuild").BuildOptions} */
const options = {
  banner: {
    // @google/design.md calls createRequire(import.meta.url), but esbuild's
    // CJS polyfill leaves import.meta as {}, so url is undefined without this.
    js: 'var __import_meta_url=require("url").pathToFileURL(__filename).href;',
  },
  bundle: true,
  define: {
    "import.meta.url": "__import_meta_url",
  },
  entryPoints: ["src/extension.js"],
  external: ["vscode"],
  format: "cjs",
  loader: {
    ".css": "text",
    ".md": "text",
  },
  minify,
  outfile: "out/extension.js",
  platform: "node",
  sourcemap: true,
  target: "node22",
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
