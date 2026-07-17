/** End-to-end tests against the built MCP server (run `npm run build` first). */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/server.js'
);

let client: Client;

function textOf(result: any): string {
  return result.content[0].text as string;
}

beforeAll(async () => {
  client = new Client({ name: 'puzzletide-mcp-test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [serverPath] })
  );
}, 30000);

afterAll(async () => {
  await client.close();
});

describe('puzzletide-mcp', () => {
  it('lists every non-interactive registry tool', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain('puzzle_wordsearch_generate');
    expect(names).toContain('puzzle_crossword_generate');
    expect(names).toContain('puzzle_sudoku_generate');
    expect(names).toContain('puzzle_sudoku_solve');
    expect(names).toContain('puzzle_sudoku_validate');
    expect(names).toContain('words_match');
    expect(names).toContain('eval_generate');
    expect(names).toContain('play_daily');
    expect(names).not.toContain('play_hangman');
    expect(names.length).toBeGreaterThanOrEqual(15);

    for (const name of names) {
      expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
    }
  });

  it('generates a deterministic sudoku', async () => {
    const call = () =>
      client.callTool({
        name: 'puzzle_sudoku_generate',
        arguments: { difficulty: 'easy', seed: 42 },
      });

    const a = JSON.parse(textOf(await call()));
    const b = JSON.parse(textOf(await call()));

    expect(a.puzzle).toHaveLength(81);
    expect(a.solution).toHaveLength(81);
    expect(a).toEqual(b);
  });

  it('solves a generated sudoku', async () => {
    const generated = JSON.parse(
      textOf(
        await client.callTool({
          name: 'puzzle_sudoku_generate',
          arguments: { difficulty: 'easy', seed: 7 },
        })
      )
    );
    const solved = JSON.parse(
      textOf(
        await client.callTool({
          name: 'puzzle_sudoku_solve',
          arguments: { grid: generated.puzzle },
        })
      )
    );
    expect(solved.solution).toBe(generated.solution);
    expect(solved.unique).toBe(true);
  });

  it('generates a word search with verifiable placements', async () => {
    const data = JSON.parse(
      textOf(
        await client.callTool({
          name: 'puzzle_wordsearch_generate',
          arguments: { words: 'coral,shark,kelp', seed: 3 },
        })
      )
    );

    expect(data.words).toHaveLength(3);
    for (const placed of data.words) {
      const rowDelta = Math.sign(placed.endRow - placed.startRow);
      const colDelta = Math.sign(placed.endCol - placed.startCol);
      let extracted = '';
      for (let i = 0; i < placed.normalizedWord.length; i++) {
        extracted += data.grid[placed.startRow + rowDelta * i][placed.startCol + colDelta * i];
      }
      expect(extracted).toBe(placed.normalizedWord);
    }
  });

  it('matches word patterns from the bundled banks', async () => {
    const data = JSON.parse(
      textOf(await client.callTool({ name: 'words_match', arguments: { pattern: 'c_r_l' } }))
    );
    expect(data.matches).toContain('CORAL');
  });

  it('handles the boolean negated option (solutionPage)', async () => {
    const { tools } = await client.listTools();
    const wordsearch = tools.find((t) => t.name === 'puzzle_wordsearch_generate');
    expect(wordsearch?.inputSchema.properties).toHaveProperty('solutionPage');
  });

  it('returns isError for invalid input instead of crashing', async () => {
    const result = await client.callTool({
      name: 'puzzle_sudoku_solve',
      arguments: { grid: '123' },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('81');

    // Server is still alive afterwards.
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });
});
