import { describe, expect, it } from 'vitest';
import { evalTools } from '../src/tools/evals.js';
import { solveSudoku, parseSudokuGrid, serializeSudokuGrid } from '../src/engines/sudoku.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const generate = evalTools.find((t) => t.id === 'eval.generate')!;
const check = evalTools.find((t) => t.id === 'eval.check')!;

function tempFile(name: string, content: string): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ptide-test-')), name);
  fs.writeFileSync(file, content);
  return file;
}

async function grade(tasksPayload: unknown, answers: unknown): Promise<any> {
  const tasksFile = tempFile('tasks.json', JSON.stringify(tasksPayload));
  const answersFile = tempFile('answers.json', JSON.stringify(answers));
  const result = await check.run({ options: { tasks: tasksFile, answers: answersFile }, args: [] });
  return result.data as any;
}

describe('eval generate', () => {
  it('produces deterministic sudoku task sets', async () => {
    const opts = { type: 'sudoku', n: '3', difficulty: 'easy', seed: '9' };
    const a = (await generate.run({ options: opts, args: [] })).data as any;
    const b = (await generate.run({ options: opts, args: [] })).data as any;
    expect(a).toEqual(b);
    expect(a.tasks).toHaveLength(3);
    for (const task of a.tasks) {
      expect(task.puzzle).toHaveLength(81);
      expect(task.instructions).toBeTruthy();
    }
  });

  it('produces word search tasks with the words present', async () => {
    const payload = (
      await generate.run({ options: { type: 'wordsearch', n: '2', seed: '3' }, args: [] })
    ).data as any;
    expect(payload.tasks).toHaveLength(2);
    for (const task of payload.tasks) {
      expect(task.grid.length).toBeGreaterThan(0);
      expect(task.words.length).toBeGreaterThan(0);
    }
  });
});

describe('eval check', () => {
  it('passes correct sudoku answers and fails wrong ones', async () => {
    const payload = (
      await generate.run({ options: { type: 'sudoku', n: '2', difficulty: 'easy', seed: '11' }, args: [] })
    ).data as any;

    const answers = payload.tasks.map((task: any) => ({
      id: task.id,
      answer: serializeSudokuGrid(solveSudoku(parseSudokuGrid(task.puzzle))!),
    }));

    const good = await grade(payload, answers);
    expect(good.summary.passed).toBe(2);
    expect(good.summary.score).toBe(1);

    // Change a non-given cell to break sudoku rules.
    const sabotaged = structuredClone(answers);
    const first = sabotaged[0].answer.split('');
    const givens = parseSudokuGrid(payload.tasks[0].puzzle);
    outer: for (let i = 0; i < 81; i++) {
      if (givens[Math.floor(i / 9)][i % 9] === null) {
        first[i] = String((Number(first[i]) % 9) + 1);
        sabotaged[0].answer = first.join('');
        break outer;
      }
    }

    const bad = await grade(payload, sabotaged);
    expect(bad.summary.passed).toBe(1);
    expect(bad.results.find((r: any) => !r.pass).reason).toMatch(/violation|changed|empty/);
  });

  it('verifies word search answers against the grid', async () => {
    const payload = (
      await generate.run({ options: { type: 'wordsearch', n: '1', seed: '8' }, args: [] })
    ).data as any;
    const task = payload.tasks[0];

    // Recover true placements by brute force so the test is self-contained.
    const grid: string[][] = task.grid.map((row: string) => row.split(''));
    const found: any[] = [];
    const deltas = [
      [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    for (const word of task.words) {
      outer: for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          for (const [dr, dc] of deltas) {
            let ok = true;
            for (let i = 0; i < word.length; i++) {
              if (grid[r + dr * i]?.[c + dc * i] !== word[i]) {
                ok = false;
                break;
              }
            }
            if (ok) {
              found.push({
                word,
                startRow: r,
                startCol: c,
                endRow: r + dr * (word.length - 1),
                endCol: c + dc * (word.length - 1),
              });
              break outer;
            }
          }
        }
      }
    }
    expect(found).toHaveLength(task.words.length);

    const good = await grade(payload, [{ id: task.id, answer: found }]);
    expect(good.summary.passed).toBe(1);

    // Wrong coordinates fail.
    const wrong = found.map((f: any) => ({ ...f, startCol: (f.startCol + 1) % grid[0].length }));
    const bad = await grade(payload, [{ id: task.id, answer: wrong }]);
    expect(bad.summary.passed).toBe(0);
  });

  it('counts missing answers as failures', async () => {
    const payload = (
      await generate.run({ options: { type: 'sudoku', n: '2', difficulty: 'easy', seed: '13' }, args: [] })
    ).data as any;
    const graded = await grade(payload, []);
    expect(graded.summary.passed).toBe(0);
    expect(graded.summary.answered).toBe(0);
  });
});
