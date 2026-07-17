/** Generator tools: word search, crossword, and sudoku. */

import { CliError } from '../core/errors.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../core/registry.js';
import { generateCrossword, validateClueGridConsistency } from '../engines/crossword.js';
import {
  SUDOKU_DIFFICULTIES,
  generateSudoku,
  parseSudokuGrid,
  serializeSudokuGrid,
  solveSudoku,
  validateSudoku,
} from '../engines/sudoku.js';
import { generateWordSearch } from '../engines/wordsearch.js';
import type { Direction, SudokuDifficulty, WordSearchDifficulty } from '../engines/types.js';
import { DIRECTIONS, WORD_SEARCH_DIRECTION_PRESETS } from '../engines/types.js';
import { crosswordAscii, sudokuAscii, wordSearchAscii } from '../render/ascii.js';
import { crosswordSvg, sudokuSvg, wordSearchSvg } from '../render/svg.js';
import { crosswordPdf, sudokuPdf, wordSearchPdf } from '../render/pdf.js';
import {
  parseIntOption,
  parsePaper,
  parseWordClueList,
  readGridInput,
  readTextFile,
  resolveWords,
  seedFromOptions,
  writeFile,
} from './common.js';

const RENDER_OPTIONS = [
  { flag: '--title <title>', description: 'Title used in SVG/PDF output' },
  { flag: '--svg <file>', description: 'Also write an SVG image to <file>' },
  { flag: '--pdf <file>', description: 'Also write a printable PDF worksheet to <file>' },
  { flag: '--paper <size>', description: 'PDF paper size: letter or a4', default: 'letter' },
  { flag: '--solution', description: 'Print the solution instead of the puzzle' },
  {
    flag: '--no-solution-page',
    description: 'Omit the solution page from PDF output',
  },
] as const;

function renderNotes(written: string[]): string {
  return written.length > 0 ? `\n\n${written.map((w) => `Wrote ${w}`).join('\n')}` : '';
}

export const generateTools: ToolDefinition[] = [
  {
    id: 'puzzle.wordsearch.generate',
    namespace: 'wordsearch',
    operation: 'generate',
    category: 'puzzle',
    summary: 'Generate a word search grid from words, a file, or a themed word bank.',
    description:
      'Places every word in a letter grid (8 possible directions, difficulty presets) and fills ' +
      'the rest with random letters. Deterministic with --seed. Words come from --words, ' +
      '--file (one per line), or --theme (bundled PuzzleTide word banks). Output: text grid, ' +
      '--json structured data, --svg image, or --pdf printable worksheet with solution page.',
    options: [
      { flag: '--words <list>', description: 'Comma-separated words, e.g. "cat,dog,fish"' },
      { flag: '--file <path>', description: 'Read words from a file (one per line or comma-separated)' },
      { flag: '--theme <id>', description: 'Use a bundled word bank theme (see: ptide words themes)' },
      { flag: '--count <n>', description: 'Number of words to use from the theme/file', default: 12 },
      { flag: '--size <n>', description: 'Square grid size (6-30); computed from words if omitted' },
      { flag: '--rows <n>', description: 'Grid rows (overrides --size)' },
      { flag: '--cols <n>', description: 'Grid columns (overrides --size)' },
      {
        flag: '--difficulty <level>',
        description: 'Direction preset: easy (E,S), medium (+diagonals), hard (all 8)',
        default: 'medium',
      },
      {
        flag: '--directions <list>',
        description: `Explicit directions (comma-separated from: ${DIRECTIONS.join(',')})`,
      },
      { flag: '--seed <seed>', description: 'Seed for reproducible output (number or word)' },
      ...RENDER_OPTIONS,
    ],
    examples: [
      { title: 'From an inline list', command: 'ptide wordsearch generate --words "coral,shark,kelp,wave"' },
      { title: 'From a themed bank, printable', command: 'ptide wordsearch generate --theme animals/ocean-animals --pdf ocean.pdf' },
      { title: 'Structured output for agents', command: 'ptide run puzzle.wordsearch.generate --theme space --json' },
    ],
    online: 'https://puzzletide.com/word-search',
    run: runWordSearchGenerate,
  },
  {
    id: 'puzzle.crossword.generate',
    namespace: 'crossword',
    operation: 'generate',
    category: 'puzzle',
    summary: 'Generate a crossword from word/clue pairs or a themed word bank.',
    description:
      'Builds an interlocking crossword grid with standard numbering. Words come from ' +
      '--words "WORD: clue; WORD2: clue2", --file (JSON [{word,clue}] or "WORD: clue" lines), ' +
      'or --theme (clues are auto-generated puzzle-style hints). Words that cannot interlock ' +
      'are reported as unplaced. Deterministic with --seed.',
    options: [
      { flag: '--words <list>', description: 'Semicolon-separated "WORD: clue" pairs' },
      { flag: '--file <path>', description: 'JSON array of {word, clue} or "WORD: clue" lines' },
      { flag: '--theme <id>', description: 'Use a bundled word bank theme (auto-generated clues)' },
      { flag: '--count <n>', description: 'Number of words to use from the theme/file', default: 10 },
      { flag: '--size <n>', description: 'Working grid size before trimming (5-25)', default: 15 },
      { flag: '--seed <seed>', description: 'Seed for reproducible output (number or word)' },
      ...RENDER_OPTIONS,
    ],
    examples: [
      {
        title: 'Explicit clues',
        command: 'ptide crossword generate --words "PARIS: Capital of France; TOKYO: Capital of Japan"',
      },
      { title: 'Themed, printable', command: 'ptide crossword generate --theme food/fruits --pdf fruits.pdf' },
      { title: 'Structured output', command: 'ptide run puzzle.crossword.generate --theme animals --json' },
    ],
    online: 'https://puzzletide.com/crossword',
    run: runCrosswordGenerate,
  },
  {
    id: 'puzzle.sudoku.generate',
    namespace: 'sudoku',
    operation: 'generate',
    category: 'puzzle',
    summary: 'Generate a sudoku with a guaranteed unique solution.',
    description:
      'Generates a 9x9 sudoku at easy/medium/hard/expert difficulty. Every puzzle is verified ' +
      'to have exactly one solution. Deterministic with --seed. The canonical string format is ' +
      '81 characters, row by row, "." for empty cells.',
    options: [
      {
        flag: '--difficulty <level>',
        description: `One of: ${SUDOKU_DIFFICULTIES.join(', ')}`,
        default: 'medium',
      },
      { flag: '--seed <seed>', description: 'Seed for reproducible output (number or word)' },
      ...RENDER_OPTIONS,
    ],
    examples: [
      { title: 'Hard puzzle', command: 'ptide sudoku generate --difficulty hard' },
      { title: 'Reproducible + printable', command: 'ptide sudoku generate --seed 42 --pdf sudoku.pdf' },
      { title: 'Structured output', command: 'ptide run puzzle.sudoku.generate --difficulty expert --json' },
    ],
    online: 'https://puzzletide.com/sudoku',
    run: runSudokuGenerate,
  },
  {
    id: 'puzzle.sudoku.solve',
    namespace: 'sudoku',
    operation: 'solve',
    category: 'puzzle',
    summary: 'Solve a sudoku from an 81-character string or file.',
    description:
      'Solves a 9x9 sudoku via backtracking. Input: 81 characters row by row with 1-9 for ' +
      'givens and 0/./_ for empty cells (whitespace and separators are ignored), passed ' +
      'inline, via --file, or on stdin. Reports whether the solution is unique.',
    positional: { name: '[grid]', description: '81-character puzzle string (or "-" for stdin)' },
    options: [{ flag: '--file <path>', description: 'Read the grid from a file' }],
    examples: [
      {
        title: 'Solve inline',
        command: 'ptide sudoku solve "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79"',
      },
      { title: 'Solve from a file', command: 'ptide sudoku solve --file puzzle.txt --json' },
    ],
    online: 'https://puzzletide.com/sudoku',
    run: runSudokuSolve,
  },
  {
    id: 'puzzle.sudoku.validate',
    namespace: 'sudoku',
    operation: 'validate',
    category: 'puzzle',
    summary: 'Validate a sudoku: conflicts, solvability, and solution uniqueness.',
    description:
      'Checks a 9x9 sudoku grid for well-formedness, conflicting givens, solvability, and ' +
      'whether the solution is unique (a proper sudoku has exactly one). Same input formats ' +
      'as sudoku solve.',
    positional: { name: '[grid]', description: '81-character puzzle string (or "-" for stdin)' },
    options: [{ flag: '--file <path>', description: 'Read the grid from a file' }],
    examples: [
      { title: 'Validate a puzzle', command: 'ptide sudoku validate --file puzzle.txt' },
      { title: 'Agent-friendly check', command: 'ptide run puzzle.sudoku.validate "..." --json' },
    ],
    online: 'https://puzzletide.com/sudoku',
    run: runSudokuValidate,
  },
];

// ----------------------------------------------------------------------------
// Word search
// ----------------------------------------------------------------------------

async function runWordSearchGenerate(ctx: ToolContext): Promise<ToolResult> {
  const opts = ctx.options;
  const seed = seedFromOptions(opts);

  const { words, theme } = resolveWords({
    words: opts.words as string | undefined,
    file: opts.file as string | undefined,
    theme: opts.theme as string | undefined,
    count: parseIntOption(opts.count, '--count'),
    seed,
  });

  const difficulty = ((opts.difficulty as string | undefined) ?? 'medium') as WordSearchDifficulty;
  if (!(difficulty in WORD_SEARCH_DIRECTION_PRESETS)) {
    throw new CliError('--difficulty must be easy, medium, or hard.');
  }

  let directions: Direction[] = WORD_SEARCH_DIRECTION_PRESETS[difficulty];
  if (typeof opts.directions === 'string') {
    directions = (opts.directions as string).split(',').map((d) => {
      const dir = d.trim().toUpperCase() as Direction;
      if (!DIRECTIONS.includes(dir)) {
        throw new CliError(`Unknown direction "${d}". Valid: ${DIRECTIONS.join(', ')}`);
      }
      return dir;
    });
  }

  const size = parseIntOption(opts.size, '--size');
  const puzzle = generateWordSearch({
    words,
    rows: parseIntOption(opts.rows, '--rows') ?? size,
    cols: parseIntOption(opts.cols, '--cols') ?? size,
    directions,
    seed,
  });

  const title = (opts.title as string | undefined) ?? theme?.title ?? 'Word Search';
  const written: string[] = [];

  if (typeof opts.svg === 'string') {
    writeFile(opts.svg, wordSearchSvg(puzzle, { title, solution: Boolean(opts.solution) }));
    written.push(opts.svg);
  }
  if (typeof opts.pdf === 'string') {
    writeFile(
      opts.pdf,
      await wordSearchPdf(puzzle, {
        title,
        paper: parsePaper(opts.paper),
        includeSolution: opts.solutionPage !== false,
      })
    );
    written.push(opts.pdf);
  }

  return {
    data: {
      type: 'word-search',
      title,
      seed: puzzle.seed,
      difficulty,
      rows: puzzle.rows,
      cols: puzzle.cols,
      allowedDirections: puzzle.allowedDirections,
      theme: theme?.id ?? null,
      grid: puzzle.grid.map((row) => row.join('')),
      words: puzzle.words,
    },
    text:
      wordSearchAscii(puzzle, { solution: Boolean(opts.solution) }) +
      `\n\nSeed: ${puzzle.seed} (reproduce with --seed ${puzzle.seed})` +
      renderNotes(written),
  };
}

// ----------------------------------------------------------------------------
// Crossword
// ----------------------------------------------------------------------------

async function runCrosswordGenerate(ctx: ToolContext): Promise<ToolResult> {
  const opts = ctx.options;
  const seed = seedFromOptions(opts);

  let entries;
  let themeTitle: string | null = null;
  const sources = [opts.words, opts.file, opts.theme].filter(Boolean).length;
  if (sources !== 1) {
    throw new CliError(
      'Pass exactly one of --words, --file, or --theme.',
      'Example: ptide crossword generate --words "PARIS: Capital of France; TOKYO: Capital of Japan"'
    );
  }

  if (typeof opts.theme === 'string') {
    const { words, theme } = resolveWords({
      theme: opts.theme,
      count: parseIntOption(opts.count, '--count') ?? 10,
      seed,
    });
    themeTitle = theme?.title ?? null;
    entries = parseWordClueList(words.join('\n'));
  } else {
    const raw = typeof opts.file === 'string' ? readTextFile(opts.file) : (opts.words as string);
    entries = parseWordClueList(raw);
    const count = parseIntOption(opts.count, '--count');
    if (count && count < entries.length) {
      entries = entries.slice(0, count);
    }
  }

  const size = parseIntOption(opts.size, '--size') ?? 15;
  const puzzle = generateCrossword({
    words: entries,
    gridSize: { rows: size, cols: size },
    seed,
  });

  const consistency = validateClueGridConsistency(puzzle);
  if (!consistency.isConsistent) {
    throw new CliError('Internal error: generated crossword failed validation.');
  }

  const title = (opts.title as string | undefined) ?? themeTitle ?? 'Crossword';
  const written: string[] = [];

  if (typeof opts.svg === 'string') {
    writeFile(opts.svg, crosswordSvg(puzzle, { title, solution: Boolean(opts.solution) }));
    written.push(opts.svg);
  }
  if (typeof opts.pdf === 'string') {
    writeFile(
      opts.pdf,
      await crosswordPdf(puzzle, {
        title,
        paper: parsePaper(opts.paper),
        includeSolution: opts.solutionPage !== false,
      })
    );
    written.push(opts.pdf);
  }

  const unplacedNote =
    puzzle.unplacedWords.length > 0
      ? `\n\nNot placed (no valid intersection): ${puzzle.unplacedWords.join(', ')}`
      : '';

  return {
    data: {
      type: 'crossword',
      title,
      seed: puzzle.seed,
      rows: puzzle.grid.length,
      cols: puzzle.grid[0]?.length ?? 0,
      grid: puzzle.grid.map((row) => row.map((c) => c ?? '#').join('')),
      clues: puzzle.clues,
      placedWords: puzzle.placedWords,
      unplacedWords: puzzle.unplacedWords,
    },
    text:
      crosswordAscii(puzzle, { solution: Boolean(opts.solution) }) +
      unplacedNote +
      `\n\nSeed: ${seed} (reproduce with --seed ${seed})` +
      renderNotes(written),
  };
}

// ----------------------------------------------------------------------------
// Sudoku
// ----------------------------------------------------------------------------

async function runSudokuGenerate(ctx: ToolContext): Promise<ToolResult> {
  const opts = ctx.options;
  const seed = seedFromOptions(opts);

  const difficulty = ((opts.difficulty as string | undefined) ?? 'medium') as SudokuDifficulty;
  if (!SUDOKU_DIFFICULTIES.includes(difficulty)) {
    throw new CliError(`--difficulty must be one of: ${SUDOKU_DIFFICULTIES.join(', ')}`);
  }

  const puzzle = generateSudoku({ difficulty, seed });

  const title = (opts.title as string | undefined) ?? `Sudoku (${difficulty})`;
  const written: string[] = [];

  if (typeof opts.svg === 'string') {
    writeFile(
      opts.svg,
      Boolean(opts.solution)
        ? sudokuSvg(puzzle.solution, { title, givens: puzzle.puzzle })
        : sudokuSvg(puzzle.puzzle, { title })
    );
    written.push(opts.svg);
  }
  if (typeof opts.pdf === 'string') {
    writeFile(
      opts.pdf,
      await sudokuPdf(puzzle, {
        title,
        paper: parsePaper(opts.paper),
        includeSolution: opts.solutionPage !== false,
      })
    );
    written.push(opts.pdf);
  }

  return {
    data: {
      type: 'sudoku',
      title,
      seed: puzzle.seed,
      difficulty: puzzle.difficulty,
      givenCount: puzzle.givenCount,
      puzzle: serializeSudokuGrid(puzzle.puzzle),
      solution: serializeSudokuGrid(puzzle.solution),
      puzzleGrid: puzzle.puzzle,
      solutionGrid: puzzle.solution,
    },
    text:
      sudokuAscii(Boolean(opts.solution) ? puzzle.solution : puzzle.puzzle) +
      `\n\nDifficulty: ${puzzle.difficulty} (${puzzle.givenCount} givens)` +
      `\nString: ${serializeSudokuGrid(puzzle.puzzle)}` +
      `\nSeed: ${puzzle.seed} (reproduce with --seed ${puzzle.seed})` +
      renderNotes(written),
  };
}

async function runSudokuSolve(ctx: ToolContext): Promise<ToolResult> {
  const grid = parseSudokuGrid(readGridInput(ctx.args[0], ctx.options.file));
  const validation = validateSudoku(grid);

  if (validation.conflicts.length > 0) {
    const first = validation.conflicts[0];
    throw new CliError(
      `The puzzle has conflicting givens (e.g. ${first.digit} at row ${first.row + 1}, ` +
        `col ${first.col + 1} vs row ${first.conflictsWith.row + 1}, col ${first.conflictsWith.col + 1}).`
    );
  }

  const solution = solveSudoku(grid);
  if (!solution) {
    throw new CliError('This sudoku has no solution.');
  }

  return {
    data: {
      type: 'sudoku-solution',
      solution: serializeSudokuGrid(solution),
      solutionGrid: solution,
      unique: validation.unique,
      givenCount: validation.givenCount,
    },
    text:
      sudokuAscii(solution) +
      `\n\nString: ${serializeSudokuGrid(solution)}` +
      (validation.unique
        ? '\nThis is the unique solution.'
        : '\nWarning: this puzzle has multiple solutions; showing one of them.'),
  };
}

async function runSudokuValidate(ctx: ToolContext): Promise<ToolResult> {
  const grid = parseSudokuGrid(readGridInput(ctx.args[0], ctx.options.file));
  const validation = validateSudoku(grid);

  const lines = [
    `Well-formed: ${validation.wellFormed ? 'yes' : 'no'}`,
    `Givens: ${validation.givenCount}`,
    `Conflicts: ${validation.conflicts.length === 0 ? 'none' : validation.conflicts.length}`,
    `Solvable: ${validation.solvable ? 'yes' : 'no'}`,
    `Unique solution: ${validation.unique ? 'yes' : 'no'}`,
  ];

  for (const conflict of validation.conflicts.slice(0, 10)) {
    lines.push(
      `  - digit ${conflict.digit} at (row ${conflict.row + 1}, col ${conflict.col + 1}) conflicts with ` +
        `(row ${conflict.conflictsWith.row + 1}, col ${conflict.conflictsWith.col + 1})`
    );
  }

  const verdict = validation.unique
    ? 'Valid sudoku (exactly one solution).'
    : validation.solvable
      ? 'Solvable but NOT a proper sudoku: multiple solutions exist.'
      : 'Not solvable.';

  return {
    data: { type: 'sudoku-validation', ...validation, verdict },
    text: `${lines.join('\n')}\n\n${verdict}`,
  };
}
