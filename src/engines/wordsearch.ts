/**
 * Word search grid generator. Places every word with overlap-aware scoring,
 * with a seeded RNG threaded through so puzzles are reproducible.
 */

import { SeededRandom } from '../core/rng.js';
import { normalizeWord } from './normalize.js';
import type { Direction, PlacedWord, WordSearchPuzzle } from './types.js';

interface DirectionVector {
  rowDelta: number;
  colDelta: number;
}

const DIRECTION_VECTORS: Record<Direction, DirectionVector> = {
  N: { rowDelta: -1, colDelta: 0 },
  NE: { rowDelta: -1, colDelta: 1 },
  E: { rowDelta: 0, colDelta: 1 },
  SE: { rowDelta: 1, colDelta: 1 },
  S: { rowDelta: 1, colDelta: 0 },
  SW: { rowDelta: 1, colDelta: -1 },
  W: { rowDelta: 0, colDelta: -1 },
  NW: { rowDelta: -1, colDelta: -1 },
};

const MAX_GRID_ATTEMPTS = 6;
export const MIN_WORD_SEARCH_SIZE = 6;
export const MAX_WORD_SEARCH_SIZE = 30;

export interface WordSearchInput {
  words: string[];
  rows?: number;
  cols?: number;
  directions: Direction[];
  seed: number;
  /** Leave filler cells empty (kids mode / debugging). */
  fillEmpty?: boolean;
}

export class WordSearchError extends Error {}

/**
 * Picks a sensible square grid size for a word list: big enough for the
 * longest word and roughly 2x the letter area for comfortable filler.
 */
export function suggestGridSize(words: string[]): number {
  const normalized = words.map(normalizeWord).filter((w) => w.length > 0);
  const longest = normalized.reduce((n, w) => Math.max(n, w.length), 0);
  const letters = normalized.reduce((n, w) => n + w.length, 0);
  const areaSide = Math.ceil(Math.sqrt(letters * 2.2));
  return Math.min(MAX_WORD_SEARCH_SIZE, Math.max(MIN_WORD_SEARCH_SIZE, longest, areaSide));
}

export function generateWordSearch(input: WordSearchInput): WordSearchPuzzle {
  const words = input.words.map((w) => w.trim()).filter((w) => w.length > 0);
  if (words.length === 0) {
    throw new WordSearchError('No words provided.');
  }

  const size = suggestGridSize(words);
  const rows = clampSize(input.rows ?? size);
  const cols = clampSize(input.cols ?? size);
  const directions = Array.from(new Set(input.directions));
  if (directions.length === 0) {
    throw new WordSearchError('At least one direction is required.');
  }

  const longest = Math.max(...words.map((w) => normalizeWord(w).length));
  if (longest > Math.max(rows, cols)) {
    throw new WordSearchError(
      `Longest word (${longest} letters) does not fit in a ${rows}x${cols} grid.`
    );
  }

  const rng = new SeededRandom(input.seed);

  // Try a handful of complete grid builds before giving up. Each attempt
  // shuffles placement order slightly, but considers every valid placement,
  // so failures mean the words genuinely don't fit.
  for (let attempt = 0; attempt < MAX_GRID_ATTEMPTS; attempt++) {
    const grid = createEmptyGrid(rows, cols);
    const placedWords: PlacedWord[] = [];

    if (placeAllWords(words, grid, directions, rows, cols, placedWords, rng)) {
      if (input.fillEmpty !== false) {
        fillEmptyCells(grid, rng);
      }
      return {
        grid,
        rows,
        cols,
        words: placedWords,
        allowedDirections: directions,
        seed: input.seed,
      };
    }
  }

  throw new WordSearchError(
    `Could not place all ${words.length} words in a ${rows}x${cols} grid. ` +
      'Try a larger grid (--size), fewer words, or more directions.'
  );
}

function clampSize(size: number): number {
  if (!Number.isFinite(size)) {
    throw new WordSearchError('Grid size must be a number.');
  }
  return Math.max(MIN_WORD_SEARCH_SIZE, Math.min(MAX_WORD_SEARCH_SIZE, Math.floor(size)));
}

function createEmptyGrid(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(''));
}

function placeAllWords(
  words: string[],
  grid: string[][],
  directions: Direction[],
  rows: number,
  cols: number,
  placedWords: PlacedWord[],
  rng: SeededRandom
): boolean {
  const sortedWords = [...words]
    .map((displayWord) => ({ displayWord, normalizedWord: normalizeWord(displayWord) }))
    .sort((a, b) => b.normalizedWord.length - a.normalizedWord.length);

  for (const word of sortedWords) {
    const placement = placeWord(
      grid,
      word.normalizedWord,
      word.displayWord,
      directions,
      rows,
      cols,
      rng
    );

    if (!placement) {
      return false;
    }

    placedWords.push(placement);
  }

  return true;
}

function placeWord(
  grid: string[][],
  normalizedWord: string,
  displayWord: string,
  allowedDirections: Direction[],
  rows: number,
  cols: number,
  rng: SeededRandom
): PlacedWord | null {
  const candidates = buildCandidatePlacements(
    normalizedWord.length,
    allowedDirections,
    rows,
    cols
  );

  // Randomize iteration order a bit to avoid pathological patterns while
  // still considering every valid placement.
  shuffleInPlace(candidates, rng);

  let bestPlacement: { candidate: CandidatePlacement; score: number } | null = null;

  for (const candidate of candidates) {
    const score = placementScore(grid, normalizedWord, candidate);
    if (score === null) continue;

    // Prefer placements that reuse existing letters (higher overlap).
    const weightedScore = score + rng.next() * 0.01;
    if (!bestPlacement || weightedScore > bestPlacement.score) {
      bestPlacement = { candidate, score: weightedScore };
    }
  }

  if (!bestPlacement) {
    return null;
  }

  const { candidate } = bestPlacement;
  for (let i = 0; i < normalizedWord.length; i++) {
    const row = candidate.startRow + candidate.vector.rowDelta * i;
    const col = candidate.startCol + candidate.vector.colDelta * i;
    grid[row][col] = normalizedWord[i];
  }

  return {
    displayWord,
    normalizedWord,
    startRow: candidate.startRow,
    startCol: candidate.startCol,
    endRow: candidate.endRow,
    endCol: candidate.endCol,
    direction: candidate.direction,
  };
}

interface CandidatePlacement {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  direction: Direction;
  vector: DirectionVector;
}

function buildCandidatePlacements(
  wordLength: number,
  directions: Direction[],
  rows: number,
  cols: number
): CandidatePlacement[] {
  const placements: CandidatePlacement[] = [];

  for (const direction of directions) {
    const vector = DIRECTION_VECTORS[direction];

    const rowStartMin = vector.rowDelta < 0 ? wordLength - 1 : 0;
    const rowStartMax = vector.rowDelta > 0 ? rows - wordLength : rows - 1;
    const colStartMin = vector.colDelta < 0 ? wordLength - 1 : 0;
    const colStartMax = vector.colDelta > 0 ? cols - wordLength : cols - 1;

    if (rowStartMax < rowStartMin || colStartMax < colStartMin) {
      continue;
    }

    for (let startRow = rowStartMin; startRow <= rowStartMax; startRow++) {
      for (let startCol = colStartMin; startCol <= colStartMax; startCol++) {
        placements.push({
          startRow,
          startCol,
          endRow: startRow + vector.rowDelta * (wordLength - 1),
          endCol: startCol + vector.colDelta * (wordLength - 1),
          direction,
          vector,
        });
      }
    }
  }

  return placements;
}

function placementScore(
  grid: string[][],
  word: string,
  candidate: CandidatePlacement
): number | null {
  let overlaps = 0;

  for (let i = 0; i < word.length; i++) {
    const row = candidate.startRow + candidate.vector.rowDelta * i;
    const col = candidate.startCol + candidate.vector.colDelta * i;
    const existingLetter = grid[row][col];

    if (existingLetter !== '' && existingLetter !== word[i]) {
      return null;
    }

    if (existingLetter === word[i]) {
      overlaps++;
    }
  }

  return overlaps;
}

function shuffleInPlace<T>(items: T[], rng: SeededRandom): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function fillEmptyCells(grid: string[][], rng: SeededRandom): void {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === '') {
        grid[row][col] = letters[rng.nextInt(0, letters.length - 1)];
      }
    }
  }
}

/** Extracts the letters a placement covers; used by validation and evals. */
export function extractPlacement(
  grid: string[][],
  placement: Pick<PlacedWord, 'startRow' | 'startCol' | 'endRow' | 'endCol'>
): string | null {
  const rowDelta = Math.sign(placement.endRow - placement.startRow);
  const colDelta = Math.sign(placement.endCol - placement.startCol);
  const steps = Math.max(
    Math.abs(placement.endRow - placement.startRow),
    Math.abs(placement.endCol - placement.startCol)
  );

  // Must be a straight line in one of the 8 directions.
  const rowSpan = Math.abs(placement.endRow - placement.startRow);
  const colSpan = Math.abs(placement.endCol - placement.startCol);
  if (rowSpan !== 0 && colSpan !== 0 && rowSpan !== colSpan) {
    return null;
  }

  let word = '';
  for (let i = 0; i <= steps; i++) {
    const row = placement.startRow + rowDelta * i;
    const col = placement.startCol + colDelta * i;
    const letter = grid[row]?.[col];
    if (letter === undefined || letter === '') {
      return null;
    }
    word += letter;
  }
  return word;
}
