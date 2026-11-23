# DESIGN.md

[![VS Code Marketplace version](https://badgen.net/vs-marketplace/v/coliff.design-md-vs-code-extension?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=coliff.design-md-vs-code-extension)
[![VS Code Marketplace installs](https://badgen.net/vs-marketplace/i/coliff.design-md-vs-code-extension)](https://marketplace.visualstudio.com/items?itemName=coliff.design-md-vs-code-extension)
[![Open VSX version](https://img.shields.io/open-vsx/v/coliff/design-md-vs-code-extension?label=Open%20VSX)](https://open-vsx.org/extension/coliff/design-md-vs-code-extension)
[![Open VSX downloads](https://img.shields.io/open-vsx/dt/coliff/design-md-vs-code-extension)](https://open-vsx.org/extension/coliff/design-md-vs-code-extension)


Write, validate and preview [DESIGN.md](https://github.com/google-labs-code/design.md) files in VS Code.

A DESIGN.md file describes a design system: YAML front matter holds the design tokens (`colors`, `typography`, `rounded`, `spacing`, `components`) and the markdown body explains how to use them.

## Features

- **Validation** with the official [`@google/design.md`](https://www.npmjs.com/package/@google/design.md) linter. Broken token references, missing primary colors, low contrast, unused tokens and out-of-order sections show up in the Problems panel as you type.
- **Front matter checks** for a missing or empty `name` and duplicate keys (for example the same token twice under `colors`), each flagged on the exact line.
- **Quick fixes** to add a missing `name` to the front matter and to reorder sections into the spec's canonical order.
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

| Setting                           | Default | Description                              |
| --------------------------------- | ------- | ---------------------------------------- |
| `designMd.validate.enable`        | `true`  | Validate DESIGN.md files                 |
| `designMd.validate.contrastRatio` | `true`  | Warn about low-contrast component colors |
| `designMd.validate.debounceMs`    | `300`   | Delay before re-validating after an edit |
