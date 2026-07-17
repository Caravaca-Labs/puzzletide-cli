/** Play tools: interactive hangman in the terminal and the daily puzzle. */

import readline from 'node:readline';
import type { ToolContext, ToolDefinition, ToolResult } from '../core/registry.js';
import { dailySeed } from '../core/rng.js';
import { randomWord } from '../data/wordbanks.js';
import {
  createHangmanGame,
  getGameStatus,
  getRevealedWord,
  processGuess,
} from '../engines/hangman.js';
import { generateSudoku, serializeSudokuGrid } from '../engines/sudoku.js';
import { sudokuAscii } from '../render/ascii.js';
import { seedFromOptions } from './common.js';

const GALLOWS = [
  ['  +---+', '      |', '      |', '      |', '     ==='],
  ['  +---+', '  O   |', '      |', '      |', '     ==='],
  ['  +---+', '  O   |', '  |   |', '      |', '     ==='],
  ['  +---+', '  O   |', ' /|   |', '      |', '     ==='],
  ['  +---+', '  O   |', ' /|\\  |', '      |', '     ==='],
  ['  +---+', '  O   |', ' /|\\  |', ' /    |', '     ==='],
  ['  +---+', '  O   |', ' /|\\  |', ' / \\  |', '     ==='],
];

export const playTools: ToolDefinition[] = [
  {
    id: 'play.hangman',
    namespace: 'play',
    operation: 'hangman',
    category: 'play',
    summary: 'Play hangman in the terminal.',
    description:
      'Interactive hangman using the bundled PuzzleTide word banks. Guess one letter at a ' +
      'time; six wrong guesses and the game is over.',
    options: [
      { flag: '--theme <id>', description: 'Pick the word from one theme' },
      { flag: '--seed <seed>', description: 'Seed for a reproducible word' },
    ],
    examples: [{ title: 'Play', command: 'ptide play hangman --theme animals/zoo-animals' }],
    interactive: true,
    run: runHangman,
  },
  {
    id: 'play.daily',
    namespace: 'play',
    operation: 'daily',
    category: 'play',
    summary: "Print today's PuzzleTide daily sudoku.",
    description:
      'Prints a daily sudoku (medium difficulty) that is the same for everyone on the same ' +
      'UTC calendar day. Solve more puzzles at puzzletide.com.',
    options: [],
    examples: [{ title: "Today's puzzle", command: 'ptide daily' }],
    run: runDaily,
  },
];

async function runDaily(): Promise<ToolResult> {
  const seed = dailySeed();
  const puzzle = generateSudoku({ difficulty: 'medium', seed });
  const today = new Date().toISOString().slice(0, 10);

  return {
    data: {
      type: 'sudoku',
      date: today,
      difficulty: puzzle.difficulty,
      seed,
      puzzle: serializeSudokuGrid(puzzle.puzzle),
      solution: serializeSudokuGrid(puzzle.solution),
    },
    text:
      `PuzzleTide daily sudoku — ${today}\n\n` +
      sudokuAscii(puzzle.puzzle) +
      `\n\nCheck your answer: ptide sudoku solve "${serializeSudokuGrid(puzzle.puzzle)}"` +
      '\nMore free puzzles: https://puzzletide.com',
  };
}

async function runHangman(ctx: ToolContext): Promise<ToolResult> {
  const { word, theme } = randomWord({
    theme: ctx.options.theme as string | undefined,
    seed: ctx.options.seed !== undefined ? seedFromOptions(ctx.options) : undefined,
    minLength: 5,
  });

  let state = createHangmanGame(word.toUpperCase().replace(/[^A-Za-z]/g, ''));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log(`\nHangman — theme: ${theme.title}`);

  try {
    for (;;) {
      const status = getGameStatus(state);
      console.log('\n' + GALLOWS[Math.min(state.wrongGuesses, GALLOWS.length - 1)].join('\n'));
      console.log(`\n  ${getRevealedWord(state)}`);
      console.log(
        `  Guessed: ${[...state.guessedLetters].sort().join(' ') || '(none)'}   Wrong: ${state.wrongGuesses}/${state.maxWrongGuesses}`
      );

      if (status.isComplete) {
        console.log(
          status.isWon
            ? '\n  You won! 🎉'
            : `\n  Game over — the word was ${state.word.toUpperCase()}.`
        );
        console.log('  Play more at https://puzzletide.com/hangman\n');
        break;
      }

      const input = (await ask('\n  Guess a letter: ')).trim().toUpperCase();
      if (input === 'QUIT' || input === 'EXIT') {
        console.log(`  The word was ${state.word.toUpperCase()}.`);
        break;
      }
      if (!/^[A-Z]$/.test(input)) {
        console.log('  Enter a single letter (or "quit").');
        continue;
      }
      if (state.guessedLetters.has(input)) {
        console.log(`  Already guessed ${input}.`);
        continue;
      }

      const { state: next, result } = processGuess(state, input);
      state = next;
      console.log(result.isCorrectGuess ? `  ${input} is in the word!` : `  No ${input}.`);
    }
  } finally {
    rl.close();
  }

  return { data: null, text: '' };
}
