/**
 * Crossword generator and validator. Places words with intersections on a
 * grid, then trims to the bounding box and assigns standard crossword
 * numbering.
 */

import { normalizeCrosswordWord } from './normalize.js';
import type { CrosswordClue, CrosswordPuzzle } from './types.js';

export interface CrosswordWordInput {
  word: string;
  clue: string;
}

export interface CrosswordGeneratorInput {
  words: CrosswordWordInput[];
  gridSize?: { rows: number; cols: number };
  maxAttempts?: number;
  seed?: number;
}

export class CrosswordError extends Error {}

interface PlacementCandidate {
  row: number;
  col: number;
  direction: 'across' | 'down';
  intersections: number;
  word: string;
}

interface PlacedWordInfo {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

const DEFAULT_GRID_SIZE = { rows: 15, cols: 15 };
const DEFAULT_MAX_ATTEMPTS = 6;
const MIN_GRID_SIZE = 5;
const MAX_GRID_SIZE = 25;

/**
 * Generates a crossword puzzle from a list of words with clues.
 * Tries several word orderings and keeps the attempt that places the most
 * words; the grid is trimmed to its bounding box before numbering.
 */
export function generateCrossword(input: CrosswordGeneratorInput): CrosswordPuzzle {
  const gridSize = normalizeGridSize(input.gridSize);
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const seed = input.seed ?? 0;

  const normalizedWords = input.words
    .map((w) => ({
      word: normalizeCrosswordWord(w.word),
      clue: w.clue,
    }))
    .filter((w) => w.word.length >= 2 && w.word.length <= Math.max(gridSize.rows, gridSize.cols))
    .sort((a, b) => b.word.length - a.word.length);

  const uniqueWords = removeDuplicates(normalizedWords);

  if (uniqueWords.length === 0) {
    throw new CrosswordError('No usable words (need at least one word of 2+ letters).');
  }

  let bestResult: InternalResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = attemptGeneration(uniqueWords, gridSize, seed * 31 + attempt);

    if (!bestResult || result.placed.length > bestResult.placed.length) {
      bestResult = result;
    }

    if (result.placed.length === uniqueWords.length) {
      break;
    }
  }

  if (!bestResult || bestResult.placed.length === 0) {
    throw new CrosswordError('Could not place any words. Try a larger grid.');
  }

  return finalizePuzzle(bestResult, seed);
}

interface InternalResult {
  grid: (string | null)[][];
  placed: PlacedWordInfo[];
  unplaced: string[];
}

function attemptGeneration(
  words: { word: string; clue: string }[],
  gridSize: { rows: number; cols: number },
  attemptSeed: number
): InternalResult {
  const grid = createEmptyGrid(gridSize.rows, gridSize.cols);
  const placed: PlacedWordInfo[] = [];
  const unplaced: string[] = [];

  const shuffledWords = shuffleWithSeed(words, attemptSeed);

  for (const wordEntry of shuffledWords) {
    const candidate = findBestPlacement(grid, wordEntry.word, placed, gridSize);

    if (candidate) {
      placeWord(grid, candidate);
      placed.push({
        word: candidate.word,
        clue: wordEntry.clue,
        row: candidate.row,
        col: candidate.col,
        direction: candidate.direction,
      });
    } else {
      unplaced.push(wordEntry.word);
    }
  }

  return { grid, placed, unplaced };
}

/** Trims to the bounding box, numbers cells, and builds sorted clue lists. */
function finalizePuzzle(result: InternalResult, seed: number): CrosswordPuzzle {
  const bounds = boundingBox(result.grid);
  const grid = result.grid
    .slice(bounds.top, bounds.bottom + 1)
    .map((row) => row.slice(bounds.left, bounds.right + 1));

  const placed = result.placed.map((p) => ({
    ...p,
    row: p.row - bounds.top,
    col: p.col - bounds.left,
  }));

  const clueNumbers = assignClueNumbers(grid);
  const across: CrosswordClue[] = [];
  const down: CrosswordClue[] = [];

  for (const p of placed) {
    const number = clueNumbers.get(`${p.row},${p.col}`) ?? 0;
    const clue: CrosswordClue = {
      number,
      clue: p.clue,
      answer: p.word,
      row: p.row,
      col: p.col,
      length: p.word.length,
    };
    if (p.direction === 'across') {
      across.push(clue);
    } else {
      down.push(clue);
    }
  }

  across.sort((a, b) => a.number - b.number);
  down.sort((a, b) => a.number - b.number);

  return {
    grid,
    clues: { across, down },
    placedWords: placed.map((p) => p.word),
    unplacedWords: result.unplaced,
    seed,
  };
}

function boundingBox(grid: (string | null)[][]): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  let top = grid.length;
  let bottom = -1;
  let left = grid[0]?.length ?? 0;
  let right = -1;

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== null) {
        top = Math.min(top, row);
        bottom = Math.max(bottom, row);
        left = Math.min(left, col);
        right = Math.max(right, col);
      }
    }
  }

  if (bottom === -1) {
    return { top: 0, bottom: grid.length - 1, left: 0, right: (grid[0]?.length ?? 1) - 1 };
  }

  return { top, bottom, left, right };
}

// ----------------------------------------------------------------------------
// Word placement
// ----------------------------------------------------------------------------

function findBestPlacement(
  grid: (string | null)[][],
  word: string,
  placedWords: PlacedWordInfo[],
  gridSize: { rows: number; cols: number }
): PlacementCandidate | null {
  const candidates: PlacementCandidate[] = [];

  // First word goes through the center.
  if (placedWords.length === 0) {
    const centerRow = Math.floor(gridSize.rows / 2);
    const centerCol = Math.floor((gridSize.cols - word.length) / 2);

    if (canPlaceWord(grid, word, centerRow, centerCol, 'across', gridSize)) {
      return {
        row: centerRow,
        col: Math.max(0, centerCol),
        direction: 'across',
        intersections: 0,
        word,
      };
    }
  }

  for (let row = 0; row < gridSize.rows; row++) {
    for (let col = 0; col < gridSize.cols; col++) {
      for (const direction of ['across', 'down'] as const) {
        if (canPlaceWord(grid, word, row, col, direction, gridSize)) {
          const intersections = countIntersections(grid, word, row, col, direction);
          if (intersections > 0 || placedWords.length === 0) {
            candidates.push({ row, col, direction, intersections, word });
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.intersections - a.intersections);

  return candidates[0];
}

function canPlaceWord(
  grid: (string | null)[][],
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down',
  gridSize: { rows: number; cols: number }
): boolean {
  const rowDelta = direction === 'down' ? 1 : 0;
  const colDelta = direction === 'across' ? 1 : 0;

  const endRow = row + rowDelta * (word.length - 1);
  const endCol = col + colDelta * (word.length - 1);

  if (endRow >= gridSize.rows || endCol >= gridSize.cols) {
    return false;
  }

  // No letter directly before the word...
  const beforeRow = row - rowDelta;
  const beforeCol = col - colDelta;
  if (beforeRow >= 0 && beforeCol >= 0 && grid[beforeRow][beforeCol] !== null) {
    return false;
  }

  // ...or directly after it.
  const afterRow = row + rowDelta * word.length;
  const afterCol = col + colDelta * word.length;
  if (afterRow < gridSize.rows && afterCol < gridSize.cols && grid[afterRow][afterCol] !== null) {
    return false;
  }

  for (let i = 0; i < word.length; i++) {
    const currentRow = row + rowDelta * i;
    const currentCol = col + colDelta * i;
    const cell = grid[currentRow][currentCol];
    const letter = word[i];

    if (cell === null) {
      // Empty cell: adjacent parallel letters would create unintended words.
      if (!isAdjacentClear(grid, currentRow, currentCol, direction, gridSize)) {
        return false;
      }
    } else if (cell !== letter) {
      return false;
    }
  }

  return true;
}

function isAdjacentClear(
  grid: (string | null)[][],
  row: number,
  col: number,
  direction: 'across' | 'down',
  gridSize: { rows: number; cols: number }
): boolean {
  const perpRowDelta = direction === 'across' ? 1 : 0;
  const perpColDelta = direction === 'down' ? 1 : 0;

  const adj1Row = row + perpRowDelta;
  const adj1Col = col + perpColDelta;
  if (
    adj1Row >= 0 &&
    adj1Row < gridSize.rows &&
    adj1Col >= 0 &&
    adj1Col < gridSize.cols &&
    grid[adj1Row][adj1Col] !== null
  ) {
    return false;
  }

  const adj2Row = row - perpRowDelta;
  const adj2Col = col - perpColDelta;
  if (
    adj2Row >= 0 &&
    adj2Row < gridSize.rows &&
    adj2Col >= 0 &&
    adj2Col < gridSize.cols &&
    grid[adj2Row][adj2Col] !== null
  ) {
    return false;
  }

  return true;
}

function countIntersections(
  grid: (string | null)[][],
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down'
): number {
  const rowDelta = direction === 'down' ? 1 : 0;
  const colDelta = direction === 'across' ? 1 : 0;

  let count = 0;

  for (let i = 0; i < word.length; i++) {
    if (grid[row + rowDelta * i][col + colDelta * i] === word[i]) {
      count++;
    }
  }

  return count;
}

function placeWord(grid: (string | null)[][], candidate: PlacementCandidate): void {
  const rowDelta = candidate.direction === 'down' ? 1 : 0;
  const colDelta = candidate.direction === 'across' ? 1 : 0;

  for (let i = 0; i < candidate.word.length; i++) {
    grid[candidate.row + rowDelta * i][candidate.col + colDelta * i] = candidate.word[i];
  }
}

// ----------------------------------------------------------------------------
// Numbering and validation
// ----------------------------------------------------------------------------

/** Standard crossword numbering: left-to-right, top-to-bottom word starts. */
export function assignClueNumbers(grid: (string | null)[][]): Map<string, number> {
  const numbers = new Map<string, number>();
  let currentNumber = 1;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { startsAcross, startsDown } = getCellClueInfo(grid, row, col);

      if (startsAcross || startsDown) {
        numbers.set(`${row},${col}`, currentNumber);
        currentNumber++;
      }
    }
  }

  return numbers;
}

export function getCellClueInfo(
  grid: (string | null)[][],
  row: number,
  col: number
): { startsAcross: boolean; startsDown: boolean } {
  const cell = grid[row][col];

  if (cell === null) {
    return { startsAcross: false, startsDown: false };
  }

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  const leftIsBlocked = col === 0 || grid[row][col - 1] === null;
  const hasRightCell = col < cols - 1 && grid[row][col + 1] !== null;
  const startsAcross = leftIsBlocked && hasRightCell;

  const topIsBlocked = row === 0 || grid[row - 1][col] === null;
  const hasBelowCell = row < rows - 1 && grid[row + 1][col] !== null;
  const startsDown = topIsBlocked && hasBelowCell;

  return { startsAcross, startsDown };
}

export function extractWordFromGrid(
  grid: (string | null)[][],
  startRow: number,
  startCol: number,
  length: number,
  direction: 'across' | 'down'
): string {
  let word = '';
  const rowDelta = direction === 'down' ? 1 : 0;
  const colDelta = direction === 'across' ? 1 : 0;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let i = 0; i < length; i++) {
    const row = startRow + rowDelta * i;
    const col = startCol + colDelta * i;

    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      return '';
    }

    const cell = grid[row][col];

    if (cell === null) {
      return '';
    }

    word += cell;
  }

  return word;
}

export interface ClueConsistencyResult {
  isConsistent: boolean;
  inconsistentClues: {
    direction: 'across' | 'down';
    number: number;
    expected: string;
    actual: string;
  }[];
}

/** Verifies every clue's answer matches the grid letters at its position. */
export function validateClueGridConsistency(
  puzzle: Pick<CrosswordPuzzle, 'grid' | 'clues'>
): ClueConsistencyResult {
  const inconsistentClues: ClueConsistencyResult['inconsistentClues'] = [];

  for (const direction of ['across', 'down'] as const) {
    for (const clue of puzzle.clues[direction]) {
      const extracted = extractWordFromGrid(puzzle.grid, clue.row, clue.col, clue.length, direction);

      if (extracted !== clue.answer) {
        inconsistentClues.push({
          direction,
          number: clue.number,
          expected: clue.answer,
          actual: extracted,
        });
      }
    }
  }

  return {
    isConsistent: inconsistentClues.length === 0,
    inconsistentClues,
  };
}

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

function createEmptyGrid(rows: number, cols: number): (string | null)[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function normalizeGridSize(size?: { rows: number; cols: number }): {
  rows: number;
  cols: number;
} {
  if (!size) {
    return DEFAULT_GRID_SIZE;
  }

  return {
    rows: Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, size.rows)),
    cols: Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, size.cols)),
  };
}

function removeDuplicates(
  words: { word: string; clue: string }[]
): { word: string; clue: string }[] {
  const seen = new Set<string>();
  return words.filter((w) => {
    if (seen.has(w.word)) {
      return false;
    }
    seen.add(w.word);
    return true;
  });
}

/** Deterministic shuffle so the same seed yields the same crossword. */
function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.abs((seed * 31 + i * 17) % (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
