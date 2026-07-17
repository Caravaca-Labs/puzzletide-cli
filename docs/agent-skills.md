# Agent skills

The npm package bundles `SKILL.md` agent skills for Pi, Hermes, OpenClaw, and
other SKILL.md-based agent systems. Pi loads them straight from npm:

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

Each skill prefers the local CLI and checks `ptide`, `puzzletide`, then
`npx puzzletide`. Skills never auto-install dependencies; agents should ask
the user before installing anything.

## puzzletide-word-search

Generate word search puzzles — themed or from custom word lists, terminal or
printable PDF. The core instruction to agents: never hand-write a letter
grid; the CLI guarantees every word is actually findable.

## puzzletide-crossword

Generate crosswords with valid interlocking grids and standard numbering.
Agents write the clues (they're good at that); the CLI builds the grid (it's
good at that).

## puzzletide-sudoku

Generate sudoku with a unique-solution guarantee, solve any puzzle from its
81-character string, and validate user-provided grids for conflicts and
uniqueness.

## puzzletide-printable-puzzles

Print-ready PDF worksheets (puzzle + solution pages, letter or A4) for
classrooms, parties, and activity packets, including multi-sheet packets via
`--seed`.

## puzzletide-agent-evals

Reproducible puzzle task sets with by-construction grading — sudoku answers
are verified against the rules and givens, word search answers against the
grid — for benchmarking models and agents without an LLM judge.

## Skill layout

```
skills/
  puzzletide-word-search/SKILL.md
  puzzletide-crossword/SKILL.md
  puzzletide-sudoku/SKILL.md
  puzzletide-printable-puzzles/SKILL.md
  puzzletide-agent-evals/SKILL.md
```

The frontmatter carries `openclaw` and `hermes` metadata (tags, required
binaries, install hints) alongside the standard name/description fields.
