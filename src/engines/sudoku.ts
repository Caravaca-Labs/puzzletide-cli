/**
 * Sudoku generator, solver, and validator. Generation guarantees a unique
 * solution: digits are removed one by one and every removal is checked with
 * a solution-counting solver.
 */

import { SeededRandom } from '../core/rng.js';
import type { SudokuDifficulty, SudokuPuzzle } from './types.js';

export interface SudokuGeneratorInput {
  difficulty: SudokuDifficulty;
  seed: number;
  /** Optional cap on generation attempts (tests use this to shorten runs). */
  maxAttempts?: number;
}

/**
 * Given count ranges per difficulty. Expert sits at 17-21 givens (17 is the
 * proven minimum for a unique-solution sudoku).
 */
const DIFFICULTY_GIVEN_RANGES: Record<SudokuDifficulty, { min: number; max: number }> = {
  easy: { min: 36, max: 45 },
  medium: { min: 27, max: 35 },
  hard: { min: 22, max: 26 },
  expert: { min: 17, max: 21 },
};

const MAX_GENERATION_ATTEMPTS: Record<SudokuDifficulty, number> = {
  easy: 3,
  medium: 5,
  hard: 15,
  expert: 80,
};

export const SUDOKU_DIFFICULTIES: SudokuDifficulty[] = ['easy', 'medium', 'hard', 'expert'];

export function getDifficultyRange(difficulty: SudokuDifficulty): { min: number; max: number } {
  return { ...DIFFICULTY_GIVEN_RANGES[difficulty] };
}

/** Generates a complete valid sudoku solution using randomized backtracking. */
export function generateSudokuSolution(seed: number): number[][] {
  const rng = new SeededRandom(seed);
  const grid: number[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill(0));

  fillGrid(grid, rng);

  return grid;
}

/** Generates a sudoku puzzle with a unique solution at the given difficulty. */
export function generateSudoku(input: SudokuGeneratorInput): SudokuPuzzle {
  const baseSeed = input.seed;
  const range = DIFFICULTY_GIVEN_RANGES[input.difficulty];
  const maxSeedTries = input.maxAttempts
    ? Math.max(6, input.maxAttempts)
    : Math.max(6, MAX_GENERATION_ATTEMPTS[input.difficulty]);

  let bestResult: SudokuPuzzle | null = null;

  // Try multiple derived seeds; return the first attempt that lands in range.
  for (let seedTry = 0; seedTry < maxSeedTries; seedTry++) {
    const attemptSeed = (baseSeed + seedTry * 1000003) % 0x7fffffff;
    const result = tryGeneratePuzzle(attemptSeed, input.difficulty, range, baseSeed);

    if (result.givenCount >= range.min && result.givenCount <= range.max) {
      return result;
    }

    if (!bestResult || result.givenCount < bestResult.givenCount) {
      bestResult = result;
    }
  }

  // Fallback: force-reduce the best result toward the range.
  const fallback = bestResult ?? tryGeneratePuzzle(baseSeed, input.difficulty, range, baseSeed);
  return forceReduceToRange(fallback, range);
}

function tryGeneratePuzzle(
  seed: number,
  difficulty: SudokuDifficulty,
  range: { min: number; max: number },
  reportedSeed: number
): SudokuPuzzle {
  const rng = new SeededRandom(seed);
  const solution = generateSudokuSolution(seed);
  const puzzle: (number | null)[][] = solution.map((row) => [...row]);

  const targetGivens = rng.nextInt(range.min, range.max);

  const positions: { row: number; col: number }[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      positions.push({ row, col });
    }
  }
  const shuffledPositions = rng.shuffle(positions);

  // Remove digits one by one, keeping the solution unique.
  let currentGivens = 81;
  for (const pos of shuffledPositions) {
    if (currentGivens <= targetGivens) {
      break;
    }

    const digit = puzzle[pos.row][pos.col];
    if (digit === null) continue;

    puzzle[pos.row][pos.col] = null;

    if (hasUniqueSolution(puzzle)) {
      currentGivens--;
    } else {
      puzzle[pos.row][pos.col] = digit;
    }
  }

  // Second pass if we're still above the allowed maximum.
  if (currentGivens > range.max) {
    for (const pos of shuffledPositions) {
      if (currentGivens <= range.max) break;
      const digit = puzzle[pos.row][pos.col];
      if (digit === null) continue;

      puzzle[pos.row][pos.col] = null;
      if (hasUniqueSolution(puzzle)) {
        currentGivens--;
      } else {
        puzzle[pos.row][pos.col] = digit;
      }
    }
  }

  return {
    puzzle,
    solution,
    difficulty,
    givenCount: currentGivens,
    seed: reportedSeed,
  };
}

function forceReduceToRange(
  result: SudokuPuzzle,
  range: { min: number; max: number }
): SudokuPuzzle {
  const puzzle = result.puzzle.map((row) => [...row]);
  let givenCount = result.givenCount;

  if (givenCount >= range.min && givenCount <= range.max) {
    return result;
  }

  const maxReduceAttempts = 10;

  for (let attempt = 0; attempt < maxReduceAttempts && givenCount > range.max; attempt++) {
    const positions: { row: number; col: number }[] = [];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (puzzle[row][col] !== null) {
          positions.push({ row, col });
        }
      }
    }

    const rng = new SeededRandom(givenCount * 1000 + attempt * 7919);
    const shuffled = rng.shuffle(positions);

    for (const { row, col } of shuffled) {
      if (givenCount <= range.max) break;

      const backup = puzzle[row][col];
      puzzle[row][col] = null;

      if (hasUniqueSolution(puzzle)) {
        givenCount--;
      } else {
        puzzle[row][col] = backup;
      }
    }
  }

  return { ...result, puzzle, givenCount };
}

/** Checks whether a sudoku puzzle has exactly one solution. */
export function hasUniqueSolution(puzzle: (number | null)[][]): boolean {
  let solutionCount = 0;

  const grid = puzzle.map((row) => row.map((cell) => cell ?? 0));

  const countSolutions = (g: number[][]): boolean => {
    let emptyRow = -1;
    let emptyCol = -1;

    outer: for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (g[row][col] === 0) {
          emptyRow = row;
          emptyCol = col;
          break outer;
        }
      }
    }

    if (emptyRow === -1) {
      solutionCount++;
      return solutionCount >= 2;
    }

    const candidates = getCandidates(g, emptyRow, emptyCol);

    for (const digit of candidates) {
      g[emptyRow][emptyCol] = digit;
      if (countSolutions(g)) {
        g[emptyRow][emptyCol] = 0;
        return true;
      }
      g[emptyRow][emptyCol] = 0;
    }

    return false;
  };

  countSolutions(grid);
  return solutionCount === 1;
}

/** Solves a sudoku puzzle; returns the solution or null if unsolvable. */
export function solveSudoku(puzzle: (number | null)[][]): number[][] | null {
  const grid = puzzle.map((row) => row.map((cell) => cell ?? 0));

  if (solve(grid)) {
    return grid;
  }

  return null;
}

export function countGivens(puzzle: (number | null)[][]): number {
  let count = 0;
  for (const row of puzzle) {
    for (const cell of row) {
      if (cell !== null) {
        count++;
      }
    }
  }
  return count;
}

export interface SudokuConflict {
  row: number;
  col: number;
  digit: number;
  conflictsWith: { row: number; col: number };
}

export interface SudokuValidation {
  wellFormed: boolean;
  conflicts: SudokuConflict[];
  solvable: boolean;
  unique: boolean;
  givenCount: number;
}

/** Validates a puzzle grid: given conflicts, solvability, and uniqueness. */
export function validateSudoku(puzzle: (number | null)[][]): SudokuValidation {
  const wellFormed =
    puzzle.length === 9 &&
    puzzle.every(
      (row) =>
        row.length === 9 &&
        row.every(
          (cell) => cell === null || (Number.isInteger(cell) && cell >= 1 && cell <= 9)
        )
    );

  if (!wellFormed) {
    return { wellFormed, conflicts: [], solvable: false, unique: false, givenCount: 0 };
  }

  const conflicts = findConflicts(puzzle);
  const givenCount = countGivens(puzzle);

  if (conflicts.length > 0) {
    return { wellFormed, conflicts, solvable: false, unique: false, givenCount };
  }

  const solvable = solveSudoku(puzzle) !== null;
  const unique = solvable && hasUniqueSolution(puzzle);

  return { wellFormed, conflicts, solvable, unique, givenCount };
}

function findConflicts(puzzle: (number | null)[][]): SudokuConflict[] {
  const conflicts: SudokuConflict[] = [];

  const groups: { cells: { row: number; col: number }[] }[] = [];
  for (let i = 0; i < 9; i++) {
    groups.push({ cells: Array.from({ length: 9 }, (_, j) => ({ row: i, col: j })) });
    groups.push({ cells: Array.from({ length: 9 }, (_, j) => ({ row: j, col: i })) });
  }
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const cells: { row: number; col: number }[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          cells.push({ row: boxRow * 3 + r, col: boxCol * 3 + c });
        }
      }
      groups.push({ cells });
    }
  }

  const seen = new Set<string>();
  for (const group of groups) {
    const byDigit = new Map<number, { row: number; col: number }>();
    for (const cell of group.cells) {
      const digit = puzzle[cell.row][cell.col];
      if (digit === null) continue;
      const first = byDigit.get(digit);
      if (first) {
        const key = `${cell.row},${cell.col},${digit},${first.row},${first.col}`;
        if (!seen.has(key)) {
          seen.add(key);
          conflicts.push({ row: cell.row, col: cell.col, digit, conflictsWith: first });
        }
      } else {
        byDigit.set(digit, cell);
      }
    }
  }

  return conflicts;
}

/**
 * Parses a sudoku grid from an 81-character string (digits 1-9; 0, '.', or
 * '_' for empty) or a 9-line grid with optional separators.
 */
export function parseSudokuGrid(text: string): (number | null)[][] {
  const flattened = text.replace(/[^0-9._]/g, '');

  if (flattened.length !== 81) {
    throw new Error(
      `Expected 81 sudoku cells, found ${flattened.length}. ` +
        "Use digits 1-9 with 0, '.', or '_' for empty cells."
    );
  }

  const grid: (number | null)[][] = [];
  for (let row = 0; row < 9; row++) {
    const cells: (number | null)[] = [];
    for (let col = 0; col < 9; col++) {
      const ch = flattened[row * 9 + col];
      cells.push(ch === '0' || ch === '.' || ch === '_' ? null : Number(ch));
    }
    grid.push(cells);
  }
  return grid;
}

/** Serializes a grid to the canonical 81-character string ('.' = empty). */
export function serializeSudokuGrid(grid: (number | null)[][] | number[][]): string {
  return grid
    .map((row) => row.map((cell) => (cell === null || cell === 0 ? '.' : String(cell))).join(''))
    .join('');
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

function fillGrid(grid: number[][], rng: SeededRandom): boolean {
  let emptyRow = -1;
  let emptyCol = -1;

  outer: for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        emptyRow = row;
        emptyCol = col;
        break outer;
      }
    }
  }

  if (emptyRow === -1) {
    return true;
  }

  const digits = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  for (const digit of digits) {
    if (isValidPlacement(grid, emptyRow, emptyCol, digit)) {
      grid[emptyRow][emptyCol] = digit;
      if (fillGrid(grid, rng)) {
        return true;
      }
      grid[emptyRow][emptyCol] = 0;
    }
  }

  return false;
}

function solve(grid: number[][]): boolean {
  let emptyRow = -1;
  let emptyCol = -1;

  outer: for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        emptyRow = row;
        emptyCol = col;
        break outer;
      }
    }
  }

  if (emptyRow === -1) {
    return true;
  }

  for (let digit = 1; digit <= 9; digit++) {
    if (isValidPlacement(grid, emptyRow, emptyCol, digit)) {
      grid[emptyRow][emptyCol] = digit;
      if (solve(grid)) {
        return true;
      }
      grid[emptyRow][emptyCol] = 0;
    }
  }

  return false;
}

function isValidPlacement(grid: number[][], row: number, col: number, digit: number): boolean {
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === digit) {
      return false;
    }
  }

  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === digit) {
      return false;
    }
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === digit) {
        return false;
      }
    }
  }

  return true;
}

function getCandidates(grid: number[][], row: number, col: number): number[] {
  const used = new Set<number>();

  for (let c = 0; c < 9; c++) {
    if (grid[row][c] !== 0) {
      used.add(grid[row][c]);
    }
  }

  for (let r = 0; r < 9; r++) {
    if (grid[r][col] !== 0) {
      used.add(grid[r][col]);
    }
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] !== 0) {
        used.add(grid[r][c]);
      }
    }
  }

  const candidates: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if (!used.has(d)) {
      candidates.push(d);
    }
  }

  return candidates;
}
