/**
 * puzzletide — programmatic API.
 *
 * The same engines the `ptide` CLI uses: word search, crossword, and sudoku
 * generation/solving/validation, themed word banks, and SVG/PDF rendering.
 */

export * from './engines/types.js';
export { normalizeWord, normalizeCrosswordWord } from './engines/normalize.js';
export {
  generateWordSearch,
  suggestGridSize,
  extractPlacement,
  WordSearchError,
  type WordSearchInput,
} from './engines/wordsearch.js';
export {
  generateCrossword,
  validateClueGridConsistency,
  assignClueNumbers,
  extractWordFromGrid,
  CrosswordError,
  type CrosswordGeneratorInput,
  type CrosswordWordInput,
} from './engines/crossword.js';
export {
  generateSudoku,
  generateSudokuSolution,
  solveSudoku,
  validateSudoku,
  hasUniqueSolution,
  countGivens,
  getDifficultyRange,
  parseSudokuGrid,
  serializeSudokuGrid,
  SUDOKU_DIFFICULTIES,
  type SudokuGeneratorInput,
  type SudokuValidation,
} from './engines/sudoku.js';
export * from './engines/hangman.js';
export { generateBasicClue } from './engines/clues.js';
export {
  listCategories,
  listThemes,
  findTheme,
  searchThemes,
  pickThemeWords,
  allWords,
  matchPattern,
  findAnagrams,
  randomWord,
  type WordbankTheme,
  type WordbankCategory,
} from './data/wordbanks.js';
export { wordSearchAscii, crosswordAscii, sudokuAscii } from './render/ascii.js';
export { wordSearchSvg, crosswordSvg, sudokuSvg } from './render/svg.js';
export { wordSearchPdf, crosswordPdf, sudokuPdf, type PaperSize } from './render/pdf.js';
export { SeededRandom, hashSeed, resolveSeed, dailySeed } from './core/rng.js';
