# DESIGN.md

[![Super Linter](https://github.com/coliff/design-md-vs-code-extension/actions/workflows/super-linter.yml/badge.svg)](https://github.com/coliff/design-md-vs-code-extension/actions/workflows/super-linter.yml)
[![Tests](https://github.com/coliff/design-md-vs-code-extension/actions/workflows/test.yml/badge.svg)](https://github.com/coliff/design-md-vs-code-extension/actions/workflows/test.yml)
[![Check spelling](https://github.com/coliff/design-md-vs-code-extension/actions/workflows/spellcheck.yml/badge.svg)](https://github.com/coliff/design-md-vs-code-extension/actions/workflows/spellcheck.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)

Write, validate and preview [DESIGN.md](https://github.com/google-labs-code/design.md) files in VS Code.

A DESIGN.md file describes a design system: YAML front matter holds the design tokens (`colors`, `typography`, `rounded`, `spacing`, `components`) and the markdown body explains how to use them.

## Features

- **Validation** with the official [`@google/design.md`](https://www.npmjs.com/package/@google/design.md) linter. Broken token references, missing primary colors, low contrast, unused tokens and out-of-order sections show up in the Problems panel as you type.
- **Front matter checks** for a missing or empty `name` and duplicate keys (for example the same token twice under `colors`), each flagged on the exact line.
- **Quick fix** to reorder sections into the spec's canonical order.
- **Completions** for `{colors.primary}` style token references inside the front matter.
- **Hovers** that show the resolved value of a token reference.
- **Color swatches** and a color picker for every hex value under `colors`.
- **Live preview** with color swatches and contrast ratios, typography samples, spacing and radius scales, components, and the rendered prose.
- **Markdown preview** shows the front matter as a table at the top, with color swatches for hex values, CSS colors, and `{colors.*}` references.
- **Snippets** for front matter, tokens, components and the standard sections (type `design-`).
- **New DESIGN.md File** command that creates a spec-valid starter file.

The extension activates for any markdown file named `DESIGN.md`.

## Commands

| Command                               | Description                                         |
| ------------------------------------- | --------------------------------------------------- |
| `DESIGN.md: Open Preview`             | Open the visual preview in the current editor group |
| `DESIGN.md: Open Preview to the Side` | Open the visual preview beside the editor           |
| `DESIGN.md: Validate`                 | Re-run validation and open the Problems panel       |
| `DESIGN.md: New DESIGN.md File`       | Create `DESIGN.md` in the workspace root            |
| `DESIGN.md: Fix Section Order`        | Reorder sections to match the spec                  |

## Settings

| Setting                        | Default | Description                              |
| ------------------------------ | ------- | ---------------------------------------- |
| `designMd.validate.enable`     | `true`  | Validate DESIGN.md files                 |
| `designMd.validate.debounceMs` | `300`   | Delay before re-validating after an edit |

## Development

```sh
npm install
npm run compile   # or: npm run watch
npm test
npm run lint
npm run package   # builds a .vsix
```

Press <kbd>F5</kbd> to launch an Extension Development Host.
