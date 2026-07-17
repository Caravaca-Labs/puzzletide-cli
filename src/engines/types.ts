/**
 * Shared puzzle data types used by the engines, renderers, and CLI tools.
 */

export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface PlacedWord {
  displayWord: string;
  normalizedWord: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  direction: Direction;
}

export interface WordSearchPuzzle {
  grid: string[][];
  rows: number;
  cols: number;
  words: PlacedWord[];
  allowedDirections: Direction[];
  seed: number;
}

export interface CrosswordClue {
  /** Clue number displayed in grid */
  number: number;
  /** The hint text */
  clue: string;
  /** Solution word */
  answer: string;
  /** Start row (0-indexed) */
  row: number;
  /** Start column (0-indexed) */
  col: number;
  /** Word length */
  length: number;
}

export interface CrosswordPuzzle {
  /** Grid with letters or null for black cells */
  grid: (string | null)[][];
  clues: {
    across: CrosswordClue[];
    down: CrosswordClue[];
  };
  placedWords: string[];
  unplacedWords: string[];
  seed: number;
}

export type SudokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface SudokuPuzzle {
  /** 9x9 puzzle grid (null = empty cell, number = given) */
  puzzle: (number | null)[][];
  /** 9x9 complete solution */
  solution: number[][];
  difficulty: SudokuDifficulty;
  givenCount: number;
  seed: number;
}

export type WordSearchDifficulty = 'easy' | 'medium' | 'hard';

/** Direction presets per word search difficulty. */
export const WORD_SEARCH_DIRECTION_PRESETS: Record<WordSearchDifficulty, Direction[]> = {
  easy: ['E', 'S'],
  medium: ['E', 'S', 'SE', 'NE'],
  hard: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};
