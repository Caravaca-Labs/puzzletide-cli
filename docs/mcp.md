# MCP server

`puzzletide-mcp` exposes every non-interactive PuzzleTide tool over the
[Model Context Protocol](https://modelcontextprotocol.io) (stdio transport),
so MCP clients — Claude Desktop, Cursor, Windsurf, and others — can generate
word searches, crosswords, and sudoku, solve and validate sudoku, browse the
word banks, and run verifiable evals.

## Setup

### Claude Desktop / Claude Code

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

(Claude Code: `claude mcp add puzzletide -- npx -y puzzletide-mcp`)

### Cursor / Windsurf

Same shape in the client's MCP settings: command `npx`, args
`["-y", "puzzletide-mcp"]`.

For a global install instead of npx: `npm i -g puzzletide-mcp`, then use
command `puzzletide-mcp` with no args.

## Tool names and arguments

Tool names are the CLI registry ids (`ptide tools list`) with dots replaced
by underscores. Arguments are the CLI's options in camelCase; positional
inputs keep their name (e.g. `grid`, `pattern`, `letters`, `theme`).

| MCP tool | CLI equivalent |
|---|---|
| `puzzle_wordsearch_generate` | `ptide wordsearch generate` |
| `puzzle_crossword_generate` | `ptide crossword generate` |
| `puzzle_sudoku_generate` | `ptide sudoku generate` |
| `puzzle_sudoku_solve` | `ptide sudoku solve` |
| `puzzle_sudoku_validate` | `ptide sudoku validate` |
| `words_categories` / `words_themes` / `words_list` | `ptide words ...` |
| `words_match` / `words_anagram` / `words_random` / `words_stats` | `ptide words ...` |
| `eval_generate` / `eval_check` | `ptide eval ...` |
| `play_daily` | `ptide daily` |

Examples:

- `puzzle_sudoku_generate` with `{"difficulty": "hard", "seed": 42}`
- `puzzle_wordsearch_generate` with `{"theme": "animals/ocean-animals", "pdf": "/tmp/ocean.pdf"}`
- `puzzle_sudoku_solve` with `{"grid": "53..7....6..195...."}` (81 chars)
- `words_match` with `{"pattern": "c_r_l"}`

Every tool returns its structured JSON payload (the same shape as the CLI's
`--json` output). `pdf`, `svg`, and `out` arguments accept file paths and
write printable worksheets to disk. Boolean `solutionPage: false` omits the
answer key from PDFs.

`play_hangman` is interactive-only and not exposed over MCP.

## Registries

The server is published as
[`io.github.catorch/puzzletide`](https://registry.modelcontextprotocol.io)
in the official MCP registry (see `mcp/server.json`), on npm as
[`puzzletide-mcp`](https://www.npmjs.com/package/puzzletide-mcp), and on
[Smithery](https://smithery.ai/servers/caravaca-labs/puzzletide) — where the
[five PuzzleTide agent skills](https://smithery.ai/skills/caravaca-labs/puzzletide-word-search)
are also available.

## Privacy

Everything runs locally over stdio. No account, API key, telemetry, or
network access.
