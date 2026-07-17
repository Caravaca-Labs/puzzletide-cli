import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  generateSudoku,
  generateSudokuSolution,
  getDifficultyRange,
  hasUniqueSolution,
  parseSudokuGrid,
  serializeSudokuGrid,
  solveSudoku,
  validateSudoku,
} from '../src/engines/sudoku.js';

function expectValidSolution(grid: number[][]): void {
  const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (let i = 0; i < 9; i++) {
    expect([...grid[i]].sort((a, b) => a - b)).toEqual(expected);
    expect(grid.map((row) => row[i]).sort((a, b) => a - b)).toEqual(expected);
  }

  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const box: number[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          box.push(grid[boxRow * 3 + r][boxCol * 3 + c]);
        }
      }
      expect(box.sort((a, b) => a - b)).toEqual(expected);
    }
  }
}

describe('generateSudokuSolution', () => {
  it('produces a valid complete grid (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000000 }), (seed) => {
        expectValidSolution(generateSudokuSolution(seed));
      }),
      { numRuns: 15 }
    );
  });

  it('is deterministic for the same seed', () => {
    expect(generateSudokuSolution(99)).toEqual(generateSudokuSolution(99));
  });
});

describe('generateSudoku', () => {
  it.each(['easy', 'medium'] as const)(
    'generates a unique-solution %s puzzle whose solution matches',
    (difficulty) => {
      const result = generateSudoku({ difficulty, seed: 42 });
      const range = getDifficultyRange(difficulty);

      expect(result.givenCount).toBeGreaterThanOrEqual(range.min);
      expect(result.givenCount).toBeLessThanOrEqual(range.max);
      expectValidSolution(result.solution);
      expect(hasUniqueSolution(result.puzzle)).toBe(true);

      // Every given matches the solution.
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const given = result.puzzle[row][col];
          if (given !== null) {
            expect(given).toBe(result.solution[row][col]);
          }
        }
      }

      expect(solveSudoku(result.puzzle)).toEqual(result.solution);
    }
  );

  it('generates hard puzzles within the given range', () => {
    const result = generateSudoku({ difficulty: 'hard', seed: 7 });
    const range = getDifficultyRange('hard');
    expect(result.givenCount).toBeGreaterThanOrEqual(range.min);
    expect(result.givenCount).toBeLessThanOrEqual(range.max);
    expect(hasUniqueSolution(result.puzzle)).toBe(true);
  });
});

describe('validateSudoku', () => {
  it('accepts a generated puzzle', () => {
    const { puzzle } = generateSudoku({ difficulty: 'easy', seed: 5 });
    const validation = validateSudoku(puzzle);
    expect(validation.wellFormed).toBe(true);
    expect(validation.conflicts).toEqual([]);
    expect(validation.solvable).toBe(true);
    expect(validation.unique).toBe(true);
  });

  it('detects conflicting givens', () => {
    const { puzzle } = generateSudoku({ difficulty: 'easy', seed: 5 });
    // Force a row conflict: copy a given into another cell of the same row.
    const grid = puzzle.map((row) => [...row]);
    outer: for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] !== null) {
          const target = (col + 1) % 9;
          grid[row][target] = grid[row][col];
          break outer;
        }
      }
    }

    const validation = validateSudoku(grid);
    expect(validation.conflicts.length).toBeGreaterThan(0);
    expect(validation.solvable).toBe(false);
  });

  it('flags an under-constrained grid as non-unique', () => {
    const empty: (number | null)[][] = Array.from({ length: 9 }, () => Array(9).fill(null));
    const validation = validateSudoku(empty);
    expect(validation.solvable).toBe(true);
    expect(validation.unique).toBe(false);
  });

  it('rejects malformed grids', () => {
    const bad = Array.from({ length: 9 }, () => Array(8).fill(null));
    expect(validateSudoku(bad).wellFormed).toBe(false);
  });
});

describe('parse/serialize', () => {
  it('round-trips generated puzzles', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
        const { puzzle } = generateSudoku({ difficulty: 'easy', seed, maxAttempts: 2 });
        const text = serializeSudokuGrid(puzzle);
        expect(text).toHaveLength(81);
        expect(parseSudokuGrid(text)).toEqual(puzzle);
      }),
      { numRuns: 5 }
    );
  });

  it('accepts 0, ., and _ as empty and ignores separators', () => {
    const canonical = serializeSudokuGrid(generateSudoku({ difficulty: 'easy', seed: 3 }).puzzle);
    const noisy = canonical.replace(/\./g, '0').match(/.{9}/g)!.join('\n');
    expect(parseSudokuGrid(noisy)).toEqual(parseSudokuGrid(canonical));
  });

  it('throws on wrong length', () => {
    expect(() => parseSudokuGrid('123')).toThrow(/81/);
  });
});
