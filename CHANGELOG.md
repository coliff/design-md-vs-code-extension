# Changelog

## 1.0.5 - 2026-11-25

- **Fixed** duplicate, out-of-date problems in the Problems panel for DESIGN.md files under Git. The copies VS Code opens for diffs and change markers in the gutter are no longer linted.
- **Fixed** **Fix Section Order** adding an extra blank line at the end of files with Windows (CRLF) line endings.
- **Fixed** **Fix Section Order** attempting to edit read-only `git:` copies of DESIGN.md instead of warning the user to open the workspace file.
- **Fixed** **New DESIGN.md File** treating every `workspace.fs.stat` failure as “file missing”, which could try to overwrite when the path was actually inaccessible.
- **Fixed** the lint result counts in the preview reading "1 errors", "1 warnings" or "2 info". They now say "1 error", "1 warning" and "2 info messages".
- **Fixed** validation for DESIGN.md files opened from Remote Repositories (`vscode-vfs` URIs) so they are linted again in the Problems panel.
- **Fixed** **Validate DESIGN.md** opening an empty Problems panel without any message when the active editor shows a read-only `git:` copy of the file (for example from the diff or Timeline views).
- **Fixed** **Validate DESIGN.md** opening the Problems panel when validation is turned off in settings, without explaining why no DESIGN.md diagnostics appear.

## 1.0.4 - 2026-11-24

- **Color swatch** in the hover for color token references such as `{colors.primary}`, shown next to the resolved hex value.
- **Color swatches** in the DESIGN.md preview's prose. Hex, `rgb()` and `hsl()` colors written in the Markdown body, such as "Strictly white (#FFFFFF)", now show a small swatch. Code spans, code blocks and links are left as they are.
- **Fixed** inline color swatches in the editor only appearing for `colors`. Hex values anywhere in the front matter, such as `components.alert-primary.backgroundColor`, now get a swatch and color picker.

## 1.0.3 - 2026-11-23

- **Redesigned** the DESIGN.md preview: each section sits on its own card, colors show an "Aa" sample on the swatch, typography lists its properties next to the sample, and components render as a live preview built from their tokens.
- **Lint results** now appear at the bottom of the preview, listing each problem with its severity and line. Error, warning and info counts are only shown when they are above zero.
- **New setting** `designMd.preview.contrastBadges` shows the on-white and on-black contrast badges under each color swatch. It is off by default.
- **Fixed** low contrast of token values such as hex codes in the DESIGN.md preview and the built-in Markdown preview.
- **Fixed** low text contrast on the pass, warning and fail badges in the DESIGN.md preview. They now meet WCAG AA (4.5:1) in light and dark themes.
- **Fixed** color swatches and nested tables not appearing in VS Code's built-in Markdown preview (Ctrl+Shift+V) for DESIGN.md files.
- **Localization** in French, German, Italian, Japanese and Spanish for commands, settings, diagnostics, quick fixes, notifications and the preview. The extension follows VS Code's display language.

## 1.0.2 - 2026-11-23

- **Localization** in Japanese for commands, settings, diagnostics, quick fixes, notifications and the preview. The extension follows VS Code's display language.
- **Bug fixes**

## 1.0.1 - 2026-11-23

- **Quick fixes** to add a missing `name` to the front matter and to reorder sections into the spec's canonical order.
- **File size optimizations**
- **Bug fixes**

## 1.0.0 - 2026-11-23

Initial release.

- **Color swatches** and a color picker for every hex value under `colors`.
- **Completions** for `{colors.primary}` style token references inside the front matter.
- **Front matter checks** for a missing or empty `name` and duplicate keys, each flagged on the exact line.
- **Hovers** that show the resolved value of a token reference.
- **Live preview** with color swatches and contrast ratios, typography samples, spacing and radius scales, components, and the rendered prose.
- **Markdown preview** shows the front matter as a table, with color swatches for hex values, CSS colors, and `{colors.*}` references.
- **New DESIGN.md File** command that creates a spec-valid starter file.
- **Snippets** for front matter, tokens, components and the standard sections (type `design-`).
- **Validation** with the official [`@google/design.md`](https://www.npmjs.com/package/@google/design.md) linter, shown in the Problems panel as you type. Contrast-ratio warnings can be turned off with `designMd.validate.contrastRatio`.
