/**
 * Verifiable reasoning tasks for agent evaluation. Every task is checkable
 * by construction: sudoku answers are verified against the givens and sudoku
 * rules, word search answers are verified against the actual grid letters —
 * no answer key needs to be trusted.
 */

import { CliError } from '../core/errors.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../core/registry.js';
import { hashSeed, SeededRandom } from '../core/rng.js';
import { listThemes, pickThemeWords } from '../data/wordbanks.js';
import { normalizeWord } from '../engines/normalize.js';
import {
  SUDOKU_DIFFICULTIES,
  generateSudoku,
  parseSudokuGrid,
  serializeSudokuGrid,
  validateSudoku,
} from '../engines/sudoku.js';
import { extractPlacement, generateWordSearch } from '../engines/wordsearch.js';
import type { SudokuDifficulty, WordSearchDifficulty } from '../engines/types.js';
import { WORD_SEARCH_DIRECTION_PRESETS } from '../engines/types.js';
import { parseIntOption, readTextFile, seedFromOptions, writeFile } from './common.js';

type EvalType = 'sudoku' | 'wordsearch';

interface SudokuTask {
  id: string;
  type: 'sudoku';
  difficulty: SudokuDifficulty;
  puzzle: string;
  instructions: string;
}

interface WordSearchTask {
  id: string;
  type: 'wordsearch';
  difficulty: WordSearchDifficulty;
  grid: string[];
  words: string[];
  instructions: string;
}

type EvalTask = SudokuTask | WordSearchTask;

const SUDOKU_INSTRUCTIONS =
  'Solve this sudoku. The puzzle is 81 characters, row by row, "." for empty cells. ' +
  'Answer with the completed 81-character string (digits only).';

const WORDSEARCH_INSTRUCTIONS =
  'Find each word in the letter grid. Words run in straight lines (horizontally, vertically, ' +
  'or diagonally, possibly backwards). Answer with a JSON array of ' +
  '{"word", "startRow", "startCol", "endRow", "endCol"} using 0-indexed positions.';

export const evalTools: ToolDefinition[] = [
  {
    id: 'eval.generate',
    namespace: 'eval',
    operation: 'generate',
    category: 'eval',
    summary: 'Generate verifiable puzzle tasks for testing agents and models.',
    description:
      'Emits a JSON array of puzzle tasks with objectively checkable answers. Types: sudoku ' +
      '(unique-solution puzzles; answers verified against sudoku rules + givens) and ' +
      'wordsearch (answers verified against the grid letters). Deterministic with --seed, so ' +
      'a (seed, type, difficulty, n) tuple names a reproducible benchmark set.',
    options: [
      { flag: '--type <type>', description: 'Task type: sudoku or wordsearch', default: 'sudoku' },
      { flag: '--n <count>', description: 'Number of tasks', default: 10 },
      {
        flag: '--difficulty <level>',
        description: 'sudoku: easy|medium|hard|expert; wordsearch: easy|medium|hard',
        default: 'medium',
      },
      { flag: '--seed <seed>', description: 'Seed for a reproducible task set', default: 1 },
      { flag: '--out <file>', description: 'Write tasks JSON to a file instead of stdout' },
    ],
    examples: [
      { title: '20 hard sudoku tasks', command: 'ptide eval generate --type sudoku --n 20 --difficulty hard --out tasks.json' },
      { title: 'Word search tasks', command: 'ptide eval generate --type wordsearch --n 5 --seed 7 --json' },
    ],
    run: runEvalGenerate,
  },
  {
    id: 'eval.check',
    namespace: 'eval',
    operation: 'check',
    category: 'eval',
    summary: 'Grade answers to generated eval tasks.',
    description:
      'Grades a JSON answers file against a tasks file produced by eval generate. Verification ' +
      'is by construction: sudoku answers must satisfy sudoku rules and preserve the givens; ' +
      'word search answers must spell the word along a straight line in the grid. Outputs ' +
      'per-task results and a score summary.',
    options: [
      { flag: '--tasks <file>', description: 'Tasks JSON from eval generate (required)' },
      { flag: '--answers <file>', description: 'JSON array of {id, answer} (required)' },
    ],
    examples: [
      { title: 'Grade a run', command: 'ptide eval check --tasks tasks.json --answers answers.json --json' },
    ],
    run: runEvalCheck,
  },
];

async function runEvalGenerate(ctx: ToolContext): Promise<ToolResult> {
  const opts = ctx.options;
  const type = ((opts.type as string | undefined) ?? 'sudoku') as EvalType;
  if (type !== 'sudoku' && type !== 'wordsearch') {
    throw new CliError('--type must be sudoku or wordsearch.');
  }

  const n = parseIntOption(opts.n, '--n') ?? 10;
  if (n > 500) {
    throw new CliError('--n is capped at 500 tasks.');
  }
  const seed = opts.seed !== undefined ? seedFromOptions(opts) : 1;
  const difficulty = (opts.difficulty as string | undefined) ?? 'medium';

  const tasks: EvalTask[] = [];

  if (type === 'sudoku') {
    if (!SUDOKU_DIFFICULTIES.includes(difficulty as SudokuDifficulty)) {
      throw new CliError(`--difficulty must be one of: ${SUDOKU_DIFFICULTIES.join(', ')}`);
    }
    for (let i = 0; i < n; i++) {
      const taskSeed = hashSeed(`eval-sudoku-${seed}-${i}`);
      const puzzle = generateSudoku({ difficulty: difficulty as SudokuDifficulty, seed: taskSeed });
      tasks.push({
        id: `sudoku-${difficulty}-${seed}-${i + 1}`,
        type: 'sudoku',
        difficulty: puzzle.difficulty,
        puzzle: serializeSudokuGrid(puzzle.puzzle),
        instructions: SUDOKU_INSTRUCTIONS,
      });
    }
  } else {
    if (!(difficulty in WORD_SEARCH_DIRECTION_PRESETS)) {
      throw new CliError('--difficulty must be easy, medium, or hard for wordsearch.');
    }
    const themes = listThemes().filter((t) => t.words.length >= 8);
    for (let i = 0; i < n; i++) {
      const taskSeed = hashSeed(`eval-wordsearch-${seed}-${i}`);
      const rng = new SeededRandom(taskSeed);
      const theme = themes[rng.nextInt(0, themes.length - 1)];
      const words = pickThemeWords(theme, { count: 8, maxLength: 10, seed: taskSeed });
      const puzzle = generateWordSearch({
        words,
        directions: WORD_SEARCH_DIRECTION_PRESETS[difficulty as WordSearchDifficulty],
        seed: taskSeed,
      });
      tasks.push({
        id: `wordsearch-${difficulty}-${seed}-${i + 1}`,
        type: 'wordsearch',
        difficulty: difficulty as WordSearchDifficulty,
        grid: puzzle.grid.map((row) => row.join('')),
        words: puzzle.words.map((w) => w.normalizedWord),
        instructions: WORDSEARCH_INSTRUCTIONS,
      });
    }
  }

  const payload = { version: 1, generator: 'puzzletide', type, difficulty, seed, tasks };
  const json = JSON.stringify(payload, null, 2);

  if (typeof opts.out === 'string') {
    writeFile(opts.out, json);
    return {
      data: payload,
      text: `Wrote ${tasks.length} ${type} tasks to ${opts.out}`,
    };
  }

  return { data: payload, text: json };
}

interface EvalAnswer {
  id: string;
  answer: unknown;
}

async function runEvalCheck(ctx: ToolContext): Promise<ToolResult> {
  const tasksFile = ctx.options.tasks;
  const answersFile = ctx.options.answers;
  if (typeof tasksFile !== 'string' || typeof answersFile !== 'string') {
    throw new CliError('Both --tasks and --answers files are required.');
  }

  let tasksPayload: { tasks?: EvalTask[] };
  let answers: EvalAnswer[];
  try {
    tasksPayload = JSON.parse(readTextFile(tasksFile));
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`Invalid JSON in tasks file: ${tasksFile}`);
  }
  try {
    const parsed = JSON.parse(readTextFile(answersFile));
    answers = Array.isArray(parsed) ? parsed : parsed.answers;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`Invalid JSON in answers file: ${answersFile}`);
  }

  const tasks = tasksPayload.tasks;
  if (!Array.isArray(tasks)) {
    throw new CliError('Tasks file has no "tasks" array. Generate one with: ptide eval generate');
  }
  if (!Array.isArray(answers)) {
    throw new CliError('Answers must be a JSON array of {id, answer}.');
  }

  const answerById = new Map(answers.map((a) => [a.id, a.answer]));
  const results: { id: string; pass: boolean; reason: string }[] = [];

  for (const task of tasks) {
    const answer = answerById.get(task.id);
    if (answer === undefined) {
      results.push({ id: task.id, pass: false, reason: 'no answer submitted' });
      continue;
    }
    results.push(
      task.type === 'sudoku'
        ? checkSudokuAnswer(task, answer)
        : checkWordSearchAnswer(task, answer)
    );
  }

  const passed = results.filter((r) => r.pass).length;
  const summary = {
    tasks: tasks.length,
    answered: results.filter((r) => r.reason !== 'no answer submitted').length,
    passed,
    failed: tasks.length - passed,
    score: tasks.length > 0 ? Number((passed / tasks.length).toFixed(4)) : 0,
  };

  const lines = results.map((r) => `${r.pass ? 'PASS' : 'FAIL'}  ${r.id}${r.pass ? '' : `  (${r.reason})`}`);
  lines.push('');
  lines.push(`Score: ${passed}/${tasks.length} (${(summary.score * 100).toFixed(1)}%)`);

  return {
    data: { summary, results },
    text: lines.join('\n'),
  };
}

function checkSudokuAnswer(task: SudokuTask, answer: unknown): { id: string; pass: boolean; reason: string } {
  if (typeof answer !== 'string') {
    return { id: task.id, pass: false, reason: 'answer must be an 81-character string' };
  }

  let answerGrid: (number | null)[][];
  try {
    answerGrid = parseSudokuGrid(answer);
  } catch (error) {
    return { id: task.id, pass: false, reason: (error as Error).message };
  }

  const givens = parseSudokuGrid(task.puzzle);

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (answerGrid[row][col] === null) {
        return { id: task.id, pass: false, reason: `cell (${row},${col}) left empty` };
      }
      const given = givens[row][col];
      if (given !== null && answerGrid[row][col] !== given) {
        return { id: task.id, pass: false, reason: `given at (${row},${col}) was changed` };
      }
    }
  }

  const validation = validateSudoku(answerGrid);
  if (validation.conflicts.length > 0) {
    const c = validation.conflicts[0];
    return {
      id: task.id,
      pass: false,
      reason: `rule violation: digit ${c.digit} repeats (row ${c.row + 1}, col ${c.col + 1})`,
    };
  }

  return { id: task.id, pass: true, reason: '' };
}

function checkWordSearchAnswer(
  task: WordSearchTask,
  answer: unknown
): { id: string; pass: boolean; reason: string } {
  if (!Array.isArray(answer)) {
    return { id: task.id, pass: false, reason: 'answer must be an array of placements' };
  }

  const grid = task.grid.map((row) => row.split(''));
  const found = new Map<string, boolean>();

  for (const entry of answer) {
    const placement = entry as {
      word?: unknown;
      startRow?: unknown;
      startCol?: unknown;
      endRow?: unknown;
      endCol?: unknown;
    };
    if (
      typeof placement.word !== 'string' ||
      typeof placement.startRow !== 'number' ||
      typeof placement.startCol !== 'number' ||
      typeof placement.endRow !== 'number' ||
      typeof placement.endCol !== 'number'
    ) {
      continue;
    }
    const extracted = extractPlacement(grid, {
      startRow: placement.startRow,
      startCol: placement.startCol,
      endRow: placement.endRow,
      endCol: placement.endCol,
    });
    const target = normalizeWord(placement.word);
    if (extracted !== null && extracted === target) {
      found.set(target, true);
    }
  }

  const missing = task.words.filter((w) => !found.get(w));
  if (missing.length > 0) {
    return {
      id: task.id,
      pass: false,
      reason: `missing or wrong: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', ...' : ''}`,
    };
  }

  return { id: task.id, pass: true, reason: '' };
}
