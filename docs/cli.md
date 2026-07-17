# CLI commands

```
ptide <namespace> <operation> [input] [options]   # for humans
ptide run <tool-id> [input] [options] --json      # canonical, for scripts/agents
```

Global flags: `--json` (structured output), `--version`, `--help` on every
command. Seeds accept numbers or words (`--seed 42`, `--seed ocean`); every
generated puzzle prints its seed so it can be reproduced.

## wordsearch

### `ptide wordsearch generate`

Generate a word search grid. Exactly one word source:

- `--words <list>` — comma-separated, e.g. `"coral,shark,kelp"`
- `--file <path>` — one word per line (or comma-separated)
- `--theme <id>` — bundled word bank theme (see `ptide words themes`)

Options: `--count <n>` (words from theme/file, default 12), `--size <n>`
(square grid 6–30, auto-computed if omitted), `--rows`/`--cols`,
`--difficulty easy|medium|hard` (easy = E,S; medium adds diagonals; hard =
all 8 directions), `--directions N,NE,E,...` (explicit override), `--seed`,
`--title`, `--svg <file>`, `--pdf <file>`, `--paper letter|a4`, `--solution`
(print solution view), `--no-solution-page` (PDF).

Words with spaces, hyphens, or accents are normalized for placement
(`Sea Lion` → `SEALION`) but displayed as written in word lists.

```sh
ptide wordsearch generate --theme animals/ocean-animals --pdf ocean.pdf
ptide wordsearch generate --words "café,naïve" --difficulty easy --seed 7
```

JSON output includes the grid (row strings) and each word's placement
coordinates and direction.

## crossword

### `ptide crossword generate`

Generate an interlocking crossword. Exactly one word source:

- `--words <list>` — semicolon-separated `"WORD: clue"` pairs
- `--file <path>` — JSON array of `{word, clue}`, or `"WORD: clue"` lines
- `--theme <id>` — bundled theme; clues are deterministic puzzle-style hints

Options: `--count`, `--size <n>` (working grid before trimming, 5–25, default
15), `--seed`, `--title`, `--svg`, `--pdf`, `--paper`, `--solution`,
`--no-solution-page`.

Words that cannot interlock are listed under `unplacedWords` rather than
silently dropped. The output grid is trimmed to its bounding box; `#` marks
black cells in JSON output.

```sh
ptide crossword generate --words "PARIS: Capital of France; TOKYO: Capital of Japan"
ptide crossword generate --file words.json --pdf review.pdf --title "Unit 4 Review"
```

## sudoku

Grid format everywhere: 81 characters, row by row; `1-9` givens, `.`/`0`/`_`
empty; whitespace and separators ignored.

### `ptide sudoku generate`

`--difficulty easy|medium|hard|expert` (default medium; expert = 17–21
givens), `--seed`, `--title`, `--svg`, `--pdf`, `--paper`,
`--no-solution-page`. Every puzzle is verified to have exactly one solution.

### `ptide sudoku solve [grid]`

Input inline, via `--file <path>`, or stdin (`-`). Prints the solved grid and
whether the solution is unique.

### `ptide sudoku validate [grid]`

Reports well-formedness, given conflicts (with positions), solvability, and
solution uniqueness.

## words

Bundled word banks: 30 generic starter themes across 6 categories, written
for this package. Theme ids look like `animals/ocean-animals`. The full
curated collection lives at [puzzletide.com](https://puzzletide.com).

- `ptide words categories` — list categories
- `ptide words themes [--category <slug>] [--search <q>] [--limit <n>]`
- `ptide words list <theme> [--count] [--min-length] [--max-length] [--seed]`
- `ptide words match <pattern>` — `_` or `?` wildcards, e.g. `c_r_l`
- `ptide words anagram <letters>`
- `ptide words random [--theme <id>] [--min-length <n>] [--seed]`
- `ptide words stats`

Pattern matching and anagrams search the bundled starter banks, not a full
English dictionary.

## eval

- `ptide eval generate --type sudoku|wordsearch --n <count> --difficulty <level> --seed <seed> [--out tasks.json]`
- `ptide eval check --tasks tasks.json --answers answers.json`

Answers file: JSON array of `{id, answer}`. Sudoku answers are completed
81-character strings; word search answers are arrays of
`{word, startRow, startCol, endRow, endCol}` (0-indexed). Grading is by
construction — no answer key is trusted.

## play

- `ptide play hangman [--theme <id>] [--seed]` — interactive, six wrong
  guesses allowed
- `ptide daily` — today's sudoku (medium), identical for everyone on the same
  UTC day (alias for `ptide play daily`)

## Discovery

- `ptide tools list` — all tools with canonical ids
- `ptide tools search <query>`
- `ptide tools info <tool-id>` / `ptide tools docs <tool-id>`
- `ptide agent manifest` — JSON manifest of every non-interactive tool

See also: [tool registry](./registry.md), [agent skills](./agent-skills.md).
