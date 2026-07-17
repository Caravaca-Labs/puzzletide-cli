<!--
Keyword rationale (d4s / DataForSEO, 2026-07-16, google en):
  word search generator 33,100/mo KD37 · word search maker 33,100 KD40 · sudoku solver 40,500 KD41
  sudoku generator 1,000 KD9 · sudoku puzzle generator 170 KD10 · crossword generator 12,100 KD51
  printable word search 18,100 KD5 · printable sudoku puzzles 4,400 KD15 · expert sudoku 2,400 KD0
  daily sudoku 27,100 KD37 · hangman game 40,500 KD35 · llm evals 480 KD28
  Dev modifiers (cli/npm/javascript/github variants) are all ≤10/mo — the surfaces that matter are
  GitHub search, npm search, and Google snippets of the repo page, all of which read the repo
  description, package.json description/keywords, and README H1/H2s.
Contiguous phrases to keep intact: "word search generator", "crossword generator",
  "sudoku generator", "sudoku solver", "printable word search", "printable sudoku",
  "expert sudoku", "daily sudoku", "LLM evals", "puzzle generator CLI", "MCP server".
Top-page deep links (GSC 2026-07, by clicks): mystery-and-murder printable word search (237),
  /hangman (25), /printable (10), dyslexic-friendly blog post (9), /maker (4).
Banned claims (not shipped): word search solver, crossword solver, anagram solver (word tools
  search only the 30 starter banks), MCP server, PNG output, AI clue generation,
  nonograms/cryptograms, speed guarantees for expert sudoku, "full English dictionary".
IP rule: the package ships only the 30 generic starter themes in scripts/wordbanks-source.json —
  NEVER include or reference-compile the proprietary puzzletide.com word bank dataset here.
-->

# PuzzleTide CLI — word search, crossword & sudoku generator

[![npm package](https://img.shields.io/npm/v/puzzletide?label=npm)](https://www.npmjs.com/package/puzzletide)
[![Docs](https://img.shields.io/badge/docs-GitHub-24292F)](https://github.com/Caravaca-Labs/puzzletide-cli/tree/main/docs)
[![Agent skills](https://img.shields.io/badge/agent_skills-SKILL.md-0F766E)](https://github.com/Caravaca-Labs/puzzletide-cli/blob/main/docs/agent-skills.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Word search generator, crossword generator, and sudoku generator + solver in
one local-first puzzle generator CLI — with printable PDF worksheets, starter
word banks, verifiable LLM evals, and bundled agent skills. From the makers
of [puzzletide.com](https://puzzletide.com).

## Install

```sh
npm install -g puzzletide
ptide --version
```

The package installs both binaries:

- `ptide`
- `puzzletide`

## Why generate puzzles with a CLI

Ask a language model to write a word search and you get a grid where half the
words are broken; ask it for a sudoku and you usually get one with several
solutions, or none. Grids are exactly the kind of output LLMs are bad at and
deterministic code is good at.

PuzzleTide CLI is that deterministic code:

- Every word search word is placed and verifiable — placement coordinates are
  part of the output, and the generators are property-tested.
- Every generated sudoku is checked to have exactly one solution.
- Every crossword is validated against its own clues before it's returned.
- Same `--seed` in, same puzzle out, on any machine.

The package also ships `SKILL.md` agent skills, so coding agents (Pi, Hermes,
OpenClaw, and other SKILL.md-based systems) reach for the CLI instead of
hand-writing grids.

## Command model

```sh
ptide <namespace> <operation> [input] [options]   # for humans
ptide run <tool-id> [input] [options] --json      # canonical, for scripts/agents
ptide tools list | search <q> | info <id> | docs <id>
ptide agent manifest
```

Use short commands interactively and canonical tool ids in automation:

```sh
ptide sudoku generate --difficulty hard
ptide run puzzle.sudoku.generate --difficulty hard --json
```

## Word search generator

Eight placement directions with easy/medium/hard presets, auto-sized grids
(6–30), accent/space/hyphen normalization. Words come from flags, files, or
bundled themes:

```sh
# Word search from your own words, printed in the terminal
ptide wordsearch generate --words "coral,shark,kelp,wave,tide"

# Themed printable word search (puzzle page + solution page)
ptide wordsearch generate --theme animals/ocean-animals --pdf ocean.pdf

# Kids mode: easy = forward-only words
ptide wordsearch generate --theme seasonal/halloween --difficulty easy
```

## Crossword generator

Interlocking placement with standard crossword numbering, clue-grid
validation, and deterministic fallback clues for theme words. Words that
cannot interlock are reported instead of silently dropped:

```sh
# Crossword with your clues
ptide crossword generate --words "PARIS: Capital of France; TOKYO: Capital of Japan"

# From a JSON file, as a printable PDF
ptide crossword generate --file words.json --pdf review.pdf --title "Unit 4 Review"
```

## Sudoku generator and solver

Easy, medium, hard, and expert sudoku (17–21 givens) with a uniqueness
guarantee, an instant solver, and a validator that reports conflicts,
solvability, and solution uniqueness:

```sh
ptide sudoku generate --difficulty expert --seed 42
ptide sudoku solve "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79"
ptide sudoku validate --file puzzle.txt
ptide daily        # today's daily sudoku, same for everyone on a given UTC day
```

## Printable puzzles: PDF worksheets and SVG

Every generator takes `--pdf <file>` for a print-ready worksheet — puzzle
page(s) plus a solution page (`--paper letter|a4`, omit the answer key with
`--no-solution-page`) — and `--svg <file>` for vector images. Printable word
search and printable sudoku sheets for a classroom packet are one loop away:

```sh
for i in 1 2 3 4 5; do
  ptide sudoku generate --difficulty medium --seed "$i" --pdf "sudoku-$i.pdf" --title "Sudoku #$i"
done
```

Prefer ready-made sheets? The
[mystery and murder printable word search](https://puzzletide.com/word-search/vocabulary/mystery-and-murder/printable)
is a reader favorite, with hundreds more at
[printable puzzles](https://puzzletide.com/printable).

## Word banks and word tools

30 starter themes (ocean animals, fruits, space, halloween, ...) — browse,
search, pattern-match, anagrams, random picks. Bring your own lists via
`--words`/`--file`, or play the full curated collection at
[puzzletide.com](https://puzzletide.com):

```sh
ptide words themes --search dinosaur
ptide words match "c_r_l"        # crossword-style pattern matching
ptide words anagram coral
```

There's a hangman game in the terminal too: `ptide play hangman`.

## Agent skills

Pi can load the bundled skills directly from this npm package:

```sh
pi install npm:puzzletide
```

The package manifest declares:

```json
{
  "pi": {
    "skills": ["./skills"]
  }
}
```

Five skills are included: word search, crossword, sudoku, printable puzzles,
and agent evals. Each prefers the local CLI and checks `ptide`, `puzzletide`,
then `npx puzzletide`. Skills never auto-install anything; agents should ask
the user before installing.

## MCP server for Claude Desktop, Cursor, and any MCP client

The companion package [`puzzletide-mcp`](https://www.npmjs.com/package/puzzletide-mcp)
exposes every non-interactive tool over the Model Context Protocol — the same
word search generator, crossword generator, sudoku generator/solver, word
tools, and evals, callable from Claude Desktop, Cursor, Windsurf, or any MCP
client:

```json
{
  "mcpServers": {
    "puzzletide": {
      "command": "npx",
      "args": ["-y", "puzzletide-mcp"]
    }
  }
}
```

See [docs/mcp.md](./docs/mcp.md) for tool names, arguments, and per-client
setup.

## Verifiable LLM evals

Puzzle answers are checkable without an answer key: a sudoku answer either
satisfies the rules and preserves the givens or it doesn't; a word search
answer either spells the word along a straight line in the grid or it
doesn't. That makes puzzles clean benchmark tasks for LLM evals — no LLM
judge needed:

```sh
ptide eval generate --type sudoku --n 20 --difficulty hard --seed 1 --out tasks.json
# ...run your model on tasks.json, collect [{id, answer}] ...
ptide eval check --tasks tasks.json --answers answers.json --json
```

The (type, difficulty, n, seed) tuple fully determines the task set, so it
names a reproducible benchmark.

## Library usage

The engines are importable TypeScript with no CLI involved:

```ts
import { generateSudoku, generateWordSearch, wordSearchPdf } from 'puzzletide';

const sudoku = generateSudoku({ difficulty: 'hard', seed: 42 });
const search = generateWordSearch({
  words: ['coral', 'shark', 'kelp'],
  directions: ['E', 'S', 'SE'],
  seed: 7,
});
const pdfBytes = await wordSearchPdf(search, { title: 'Ocean Animals' });
```

More docs:

- [CLI commands](./docs/cli.md)
- [Tool registry](./docs/registry.md)
- [Agent skills](./docs/agent-skills.md)

## Online versions

Prefer a browser?

- [PuzzleTide word search](https://puzzletide.com/word-search)
- [PuzzleTide crossword](https://puzzletide.com/crossword)
- [PuzzleTide sudoku](https://puzzletide.com/sudoku)
- [PuzzleTide hangman](https://puzzletide.com/hangman)
- [Printable puzzles](https://puzzletide.com/printable)
- [Make your own puzzle](https://puzzletide.com/maker)
- [Dyslexia-friendly word search fonts and settings](https://puzzletide.com/blog/dyslexic-friendly-word-search-font-and-settings)

## Privacy

Everything runs locally. No account, no API key, no telemetry, no network
access.

## Development

```sh
npm install
npm run build     # tsc → dist/
npm test          # vitest + fast-check property tests (build first: CLI tests run dist/)
```

The starter word banks are generic, original lists written for this package
(`scripts/wordbanks-source.json`, compiled with `npm run build:wordbanks`).
Theme contributions are welcome — add an entry to the source file and run the
build. The full curated PuzzleTide word bank collection is proprietary to
puzzletide.com and is not part of this repository.

## Citing PuzzleTide CLI

If you use PuzzleTide CLI in your work — for example the verifiable puzzle
evals in a model benchmark — please cite it (or use GitHub's "Cite this
repository" button):

```bibtex
@software{puzzletide_cli,
  author  = {{Caravaca Labs}},
  title   = {PuzzleTide CLI: word search, crossword \& sudoku generator with verifiable LLM evals},
  year    = {2026},
  url     = {https://github.com/Caravaca-Labs/puzzletide-cli},
  note    = {From the makers of \url{https://puzzletide.com}}
}
```

Plain text: "PuzzleTide CLI (Caravaca Labs, 2026),
https://github.com/Caravaca-Labs/puzzletide-cli — from the makers of
https://puzzletide.com."

## License

MIT © Caravaca Labs
