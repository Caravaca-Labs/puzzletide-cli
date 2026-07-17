---
name: puzzletide-printable-puzzles
description: "Use this skill when the user wants printable puzzle worksheets — PDF activity sheets for classrooms, kids, parties, newsletters, or activity books. Produces print-ready word search, crossword, and sudoku PDFs (with solution pages) locally via the PuzzleTide CLI."
version: 0.1.0
author: Caravaca Labs
homepage: https://github.com/Caravaca-Labs/puzzletide-cli/blob/main/docs/agent-skills.md#puzzletide-printable-puzzles
metadata:
  openclaw:
    tags: ["puzzles", "printable", "pdf", "worksheets", "puzzletide", "cli"]
    requires:
      anyBins: ["ptide", "puzzletide"]
    install:
      - kind: node
        package: puzzletide
        bins: ["ptide", "puzzletide"]
  hermes:
    tags: ["puzzles", "printable", "pdf", "worksheets", "puzzletide", "cli"]
    category: content-creation
    requires_toolsets: ["terminal"]
---

# PuzzleTide Printable Puzzles

Produce print-ready puzzle PDFs with the local PuzzleTide CLI. Every PDF
includes the puzzle page(s) and a solution page (omit it with
`--no-solution-page`). Use `--paper a4` outside North America.

Prefer the local CLI. Check availability in this order:

```bash
ptide --version
puzzletide --version
npx puzzletide --version
```

If none of those work, ask the user before installing (`npm install -g puzzletide`).

## One-off worksheets

```bash
ptide wordsearch generate --theme seasonal/winter-holidays --pdf christmas.pdf --title "Christmas Word Search"
ptide crossword generate --file words.json --pdf review.pdf --title "Unit 4 Review"
ptide sudoku generate --difficulty easy --pdf sudoku.pdf --paper a4
```

## Packets (multiple sheets)

Vary `--seed` to make each sheet different, and give each file a name:

```bash
for i in 1 2 3 4 5; do
  ptide sudoku generate --difficulty medium --seed "$i" --pdf "sudoku-$i.pdf" --title "Sudoku #$i"
done
```

## Picking a theme

```bash
ptide words categories                    # animals, geography, holidays, sports, ...
ptide words themes --search halloween     # find theme ids
```

## Tips

- For kids: `ptide wordsearch generate --difficulty easy` keeps words forward-only.
- `--svg <file>` produces a vector image instead, useful for embedding in documents.
- SVG/PDF titles come from `--title`; the default is the theme title.
- Merge or rearrange pages with the user's preferred PDF tool if needed.

More printable puzzles online: https://puzzletide.com/printable

## Safety

- Everything runs locally; no account, API key, or network access.
- Do not install packages without asking the user first.
