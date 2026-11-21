import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const watch = process.argv.includes("--watch");
const minify = process.argv.includes("--minify");
const root = dirname(fileURLToPath(import.meta.url));
const specConfig = join(
  root,
  "node_modules/@google/design.md/dist/linter/spec-config.yaml",
);

/** @type {import("esbuild").Plugin} */
const copySpecConfig = {
  name: "copy-spec-config",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) {
        return;
      }
      copyFileSync(specConfig, join(root, "out/spec-config.yaml"));
    });
  },
};

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
  plugins: [copySpecConfig],
  sourcemap: true,
  target: "node22",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
