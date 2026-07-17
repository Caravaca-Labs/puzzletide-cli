# puzzletide-mcp — puzzle generator MCP server

MCP server for puzzle generation: word search generator, crossword generator,
and sudoku generator + solver, with printable PDF worksheets, themed word
banks, and verifiable LLM evals. Works with Claude Desktop, Cursor, Windsurf,
and any Model Context Protocol client. From the makers of
[puzzletide.com](https://puzzletide.com).

## Setup

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

Everything runs locally — no account, API key, telemetry, or network access.

## Tools

Tool names mirror the [PuzzleTide CLI](https://github.com/Caravaca-Labs/puzzletide-cli)
registry ids (`ptide run <tool-id>`), with underscores:

- `puzzle_wordsearch_generate` — word search from words, files, or themed banks; every placement verifiable
- `puzzle_crossword_generate` — interlocking crossword with standard numbering
- `puzzle_sudoku_generate` — easy/medium/hard/expert sudoku with a unique-solution guarantee
- `puzzle_sudoku_solve` / `puzzle_sudoku_validate` — instant solver; conflict/uniqueness checks
- `words_themes`, `words_list`, `words_match`, `words_anagram`, `words_random`, `words_categories`, `words_stats`
- `eval_generate` / `eval_check` — reproducible, objectively gradable puzzle tasks for benchmarking models
- `play_daily` — the daily sudoku

Generation is deterministic per seed. `pdf`, `svg`, and `out` arguments take
file paths and write printable worksheets (puzzle + solution pages).

Full documentation: [docs/mcp.md](https://github.com/Caravaca-Labs/puzzletide-cli/blob/main/docs/mcp.md)

## Play online

Prefer a browser? [Word search](https://puzzletide.com/word-search) ·
[Crossword](https://puzzletide.com/crossword) ·
[Sudoku](https://puzzletide.com/sudoku) ·
[Printable puzzles](https://puzzletide.com/printable) ·
[Puzzle maker](https://puzzletide.com/maker)

## License

MIT © Caravaca Labs
