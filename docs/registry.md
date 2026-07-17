# Tool registry

Every CLI operation is a registered tool with a canonical id. Run any tool by id:

```sh
ptide run <tool-id> [input] [options] --json
```

Discovery:

```sh
ptide tools list
ptide tools search <query>
ptide tools info <tool-id>
ptide tools docs <tool-id>
ptide agent manifest   # full JSON manifest
```

| Tool id | Command | Summary |
|---|---|---|
| `eval.check` | `ptide eval check` | Grade answers to generated eval tasks. |
| `eval.generate` | `ptide eval generate` | Generate verifiable puzzle tasks for testing agents and models. |
| `play.daily` | `ptide play daily` | Print today's PuzzleTide daily sudoku. |
| `puzzle.crossword.generate` | `ptide crossword generate` | Generate a crossword from word/clue pairs or a themed word bank. |
| `puzzle.sudoku.generate` | `ptide sudoku generate` | Generate a sudoku with a guaranteed unique solution. |
| `puzzle.sudoku.solve` | `ptide sudoku solve` | Solve a sudoku from an 81-character string or file. |
| `puzzle.sudoku.validate` | `ptide sudoku validate` | Validate a sudoku: conflicts, solvability, and solution uniqueness. |
| `puzzle.wordsearch.generate` | `ptide wordsearch generate` | Generate a word search grid from words, a file, or a themed word bank. |
| `words.anagram` | `ptide words anagram` | Find anagrams of the given letters in the word bank. |
| `words.categories` | `ptide words categories` | List word bank categories. |
| `words.list` | `ptide words list` | List the words in a theme. |
| `words.match` | `ptide words match` | Find words matching a crossword-style pattern. |
| `words.random` | `ptide words random` | Pick a random word (optionally from one theme). |
| `words.stats` | `ptide words stats` | Word bank statistics. |
| `words.themes` | `ptide words themes` | List or search themed word lists. |

(`play.hangman` is interactive-only and intentionally not part of the agent manifest.)

Each tool accepts `--json` for structured output. Details and examples: `ptide tools docs <tool-id>`.
