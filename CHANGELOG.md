# Changelog

## 1.0.1 - 2026-11-23

- **Quick fixes** to add a missing `name` to the front matter and to reorder sections into the spec's canonical order.
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
