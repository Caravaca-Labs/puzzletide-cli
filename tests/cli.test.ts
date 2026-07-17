/** End-to-end tests against the built CLI (run `npm run build` first). */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/cli.js');

function ptide(...args: string[]): string {
  return execFileSync('node', [cliPath, ...args], { encoding: 'utf8' });
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ptide-cli-test-'));
}

describe('ptide CLI', () => {
  it('reports its version', () => {
    expect(ptide('--version').trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('generates a word search with --json containing every word', () => {
    const data = JSON.parse(
      ptide('wordsearch', 'generate', '--words', 'coral,shark,kelp', '--seed', '42', '--json')
    );
    expect(data.type).toBe('word-search');
    expect(data.words).toHaveLength(3);
    expect(data.seed).toBe(42);

    // Each placed word's letters must be readable from the serialized grid.
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

  it('is reproducible via seed and run-by-id', () => {
    const a = ptide('run', 'puzzle.sudoku.generate', '--seed', '77', '--json');
    const b = ptide('sudoku', 'generate', '--seed', '77', '--json');
    expect(JSON.parse(a)).toEqual(JSON.parse(b));
  });

  it('solves a sudoku end to end', () => {
    const generated = JSON.parse(ptide('sudoku', 'generate', '--difficulty', 'easy', '--seed', '3', '--json'));
    const solved = JSON.parse(ptide('sudoku', 'solve', generated.puzzle, '--json'));
    expect(solved.solution).toBe(generated.solution);
    expect(solved.unique).toBe(true);
  });

  it('validates sudoku input from a file', () => {
    const dir = tempDir();
    const file = path.join(dir, 'puzzle.txt');
    const generated = JSON.parse(ptide('sudoku', 'generate', '--seed', '5', '--json'));
    fs.writeFileSync(file, generated.puzzle);
    const validation = JSON.parse(ptide('sudoku', 'validate', '--file', file, '--json'));
    expect(validation.unique).toBe(true);
  });

  it('writes SVG and PDF worksheets', () => {
    const dir = tempDir();
    const svg = path.join(dir, 'out.svg');
    const pdf = path.join(dir, 'deep', 'out.pdf');
    ptide('wordsearch', 'generate', '--theme', 'animals/ocean-animals', '--seed', '1', '--svg', svg, '--pdf', pdf);
    expect(fs.readFileSync(svg, 'utf8')).toMatch(/^<svg /);
    expect(fs.readFileSync(pdf).subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('generates a crossword from a theme', () => {
    const data = JSON.parse(ptide('crossword', 'generate', '--theme', 'animals/ocean-animals', '--seed', '2', '--json'));
    expect(data.type).toBe('crossword');
    expect(data.placedWords.length).toBeGreaterThan(3);
    expect(data.clues.across.length + data.clues.down.length).toBe(data.placedWords.length);
  });

  it('lists and describes tools', () => {
    expect(ptide('tools', 'list')).toContain('puzzle.wordsearch.generate');
    const info = JSON.parse(ptide('tools', 'info', 'puzzle.sudoku.solve', '--json'));
    expect(info.command).toBe('ptide sudoku solve');
    expect(ptide('tools', 'search', 'anagram')).toContain('words.anagram');
  });

  it('emits a valid agent manifest', () => {
    const manifest = JSON.parse(ptide('agent', 'manifest'));
    expect(manifest.name).toBe('puzzletide');
    expect(manifest.tools.length).toBeGreaterThan(10);
    expect(manifest.tools.every((t: any) => t.id && t.command && t.summary)).toBe(true);
  });

  it('runs the eval generate/check loop', () => {
    const dir = tempDir();
    const tasksFile = path.join(dir, 'tasks.json');
    const answersFile = path.join(dir, 'answers.json');
    ptide('eval', 'generate', '--type', 'sudoku', '--n', '2', '--difficulty', 'easy', '--seed', '4', '--out', tasksFile);

    const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8')).tasks;
    const answers = tasks.map((task: any) => ({
      id: task.id,
      answer: JSON.parse(ptide('sudoku', 'solve', task.puzzle, '--json')).solution,
    }));
    fs.writeFileSync(answersFile, JSON.stringify(answers));

    const graded = JSON.parse(ptide('eval', 'check', '--tasks', tasksFile, '--answers', answersFile, '--json'));
    expect(graded.summary.score).toBe(1);
  });

  it('prints the daily puzzle', () => {
    const data = JSON.parse(ptide('daily', '--json'));
    expect(data.puzzle).toHaveLength(81);
    expect(data.difficulty).toBe('medium');
  });

  it('exits non-zero with a helpful message on bad input', () => {
    let failed = false;
    try {
      ptide('sudoku', 'solve', '123');
    } catch (error: any) {
      failed = true;
      expect(String(error.stderr)).toContain('81');
      expect(error.status).toBe(1);
    }
    expect(failed).toBe(true);
  });

  it('errors cleanly on unknown themes', () => {
    let failed = false;
    try {
      ptide('wordsearch', 'generate', '--theme', 'not/a-theme');
    } catch (error: any) {
      failed = true;
      expect(String(error.stderr)).toContain('Unknown theme');
    }
    expect(failed).toBe(true);
  });
});
