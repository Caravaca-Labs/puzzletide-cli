/** Word bank tools: browse themes, pick words, match patterns, anagrams. */

import { CliError } from '../core/errors.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../core/registry.js';
import {
  allWords,
  findAnagrams,
  findTheme,
  listCategories,
  listThemes,
  matchPattern,
  pickThemeWords,
  randomWord,
  searchThemes,
} from '../data/wordbanks.js';
import { columnize } from '../render/ascii.js';
import { parseIntOption, seedFromOptions } from './common.js';

export const wordsTools: ToolDefinition[] = [
  {
    id: 'words.categories',
    namespace: 'words',
    operation: 'categories',
    category: 'words',
    summary: 'List word bank categories.',
    description:
      'Lists the bundled PuzzleTide word bank categories (animals, geography, holidays, ...) ' +
      'with their theme counts.',
    options: [],
    examples: [{ title: 'All categories', command: 'ptide words categories' }],
    run: async (): Promise<ToolResult> => {
      const categories = listCategories();
      return {
        data: { categories },
        text: categories.map((c) => `${c.slug.padEnd(24)} ${c.themes} themes`).join('\n'),
      };
    },
  },
  {
    id: 'words.themes',
    namespace: 'words',
    operation: 'themes',
    category: 'words',
    summary: 'List or search themed word lists.',
    description:
      'Lists the bundled starter themes (30 generic word lists; the full curated collection is at puzzletide.com). Filter by ' +
      '--category or full-text --search. Theme ids look like "animals/ocean-animals".',
    options: [
      { flag: '--category <slug>', description: 'Only themes in this category' },
      { flag: '--search <query>', description: 'Full-text search over id, title, and description' },
      { flag: '--limit <n>', description: 'Maximum results', default: 50 },
    ],
    examples: [
      { title: 'Search themes', command: 'ptide words themes --search ocean' },
      { title: 'One category', command: 'ptide words themes --category holidays' },
    ],
    run: async (ctx: ToolContext): Promise<ToolResult> => {
      const limit = parseIntOption(ctx.options.limit, '--limit') ?? 50;
      let themes;
      if (typeof ctx.options.search === 'string') {
        themes = searchThemes(ctx.options.search, limit);
      } else {
        themes = listThemes(ctx.options.category as string | undefined).slice(0, limit);
      }

      return {
        data: {
          themes: themes.map((t) => ({
            id: t.id,
            title: t.title,
            difficulty: t.difficulty,
            words: t.words.length,
          })),
        },
        text:
          themes.length === 0
            ? 'No themes found.'
            : themes
                .map((t) => `${t.id.padEnd(44)} ${String(t.words.length).padStart(3)} words  ${t.title}`)
                .join('\n'),
      };
    },
  },
  {
    id: 'words.list',
    namespace: 'words',
    operation: 'list',
    category: 'words',
    summary: 'List the words in a theme.',
    description:
      'Prints the words of one bundled theme, optionally filtered by length, shuffled by ' +
      '--seed, and limited by --count. Useful as input for generators or other tools.',
    positional: { name: '<theme>', description: 'Theme id, e.g. animals/ocean-animals', required: true },
    options: [
      { flag: '--count <n>', description: 'Maximum number of words' },
      { flag: '--min-length <n>', description: 'Minimum word length' },
      { flag: '--max-length <n>', description: 'Maximum word length' },
      { flag: '--seed <seed>', description: 'Shuffle deterministically before applying --count' },
    ],
    examples: [
      { title: 'Whole theme', command: 'ptide words list animals/ocean-animals' },
      { title: 'Ten short words', command: 'ptide words list animals/ocean-animals --count 10 --max-length 6' },
    ],
    run: async (ctx: ToolContext): Promise<ToolResult> => {
      const theme = findTheme(ctx.args[0] ?? '');
      if (!theme) {
        throw new CliError(
          `Unknown theme: ${ctx.args[0]}`,
          'Search themes with: ptide words themes --search <query>'
        );
      }
      const words = pickThemeWords(theme, {
        count: parseIntOption(ctx.options.count, '--count'),
        minLength: parseIntOption(ctx.options.minLength, '--min-length'),
        maxLength: parseIntOption(ctx.options.maxLength, '--max-length'),
        seed: ctx.options.seed !== undefined ? seedFromOptions(ctx.options) : undefined,
      });

      return {
        data: { theme: theme.id, title: theme.title, words },
        text: `${theme.title} (${theme.id}) — ${words.length} words\n\n${columnize(words, 3, 26).join('\n')}`,
      };
    },
  },
  {
    id: 'words.match',
    namespace: 'words',
    operation: 'match',
    category: 'words',
    summary: 'Find words matching a crossword-style pattern.',
    description:
      'Matches the bundled word bank sample against a pattern where "_" or ' +
      '"?" is any letter, e.g. "c_r_l" matches CORAL. Helpful when stuck on a crossword or ' +
      'word puzzle.',
    positional: { name: '<pattern>', description: 'Pattern with _ or ? wildcards', required: true },
    options: [{ flag: '--limit <n>', description: 'Maximum results', default: 50 }],
    examples: [
      { title: 'Five letters, C _ R _ L', command: 'ptide words match "c_r_l"' },
      { title: 'Structured output', command: 'ptide run words.match "s___k" --json' },
    ],
    run: async (ctx: ToolContext): Promise<ToolResult> => {
      const limit = parseIntOption(ctx.options.limit, '--limit') ?? 50;
      const matches = matchPattern(ctx.args[0] ?? '', limit);
      return {
        data: { pattern: ctx.args[0], matches, dictionary: 'puzzletide-wordbanks' },
        text:
          matches.length === 0
            ? 'No matches in the PuzzleTide word bank.'
            : columnize(matches, 4, 18).join('\n'),
      };
    },
  },
  {
    id: 'words.anagram',
    namespace: 'words',
    operation: 'anagram',
    category: 'words',
    summary: 'Find anagrams of the given letters in the word bank.',
    description:
      'Finds single-word anagrams of the given letters within the bundled word bank sample.',
    positional: { name: '<letters>', description: 'Letters to rearrange', required: true },
    options: [{ flag: '--limit <n>', description: 'Maximum results', default: 50 }],
    examples: [{ title: 'Anagrams of "melon"', command: 'ptide words anagram melon' }],
    run: async (ctx: ToolContext): Promise<ToolResult> => {
      const limit = parseIntOption(ctx.options.limit, '--limit') ?? 50;
      const anagrams = findAnagrams(ctx.args[0] ?? '', limit);
      return {
        data: { letters: ctx.args[0], anagrams, dictionary: 'puzzletide-wordbanks' },
        text:
          anagrams.length === 0
            ? 'No anagrams found in the PuzzleTide word bank.'
            : anagrams.join('\n'),
      };
    },
  },
  {
    id: 'words.random',
    namespace: 'words',
    operation: 'random',
    category: 'words',
    summary: 'Pick a random word (optionally from one theme).',
    description:
      'Picks a random word from the bundled word banks — the same pool the hangman game ' +
      'uses. Deterministic with --seed.',
    options: [
      { flag: '--theme <id>', description: 'Restrict to one theme' },
      { flag: '--min-length <n>', description: 'Minimum word length', default: 4 },
      { flag: '--seed <seed>', description: 'Seed for reproducible output' },
    ],
    examples: [{ title: 'Random animal', command: 'ptide words random --theme animals/zoo-animals' }],
    run: async (ctx: ToolContext): Promise<ToolResult> => {
      const { word, theme } = randomWord({
        theme: ctx.options.theme as string | undefined,
        minLength: parseIntOption(ctx.options.minLength, '--min-length'),
        seed: ctx.options.seed !== undefined ? seedFromOptions(ctx.options) : undefined,
      });
      return {
        data: { word, theme: theme.id },
        text: `${word}  (theme: ${theme.id})`,
      };
    },
  },
  {
    id: 'words.stats',
    namespace: 'words',
    operation: 'stats',
    category: 'words',
    summary: 'Word bank statistics.',
    description: 'Prints the size of the bundled word bank: categories, themes, unique words.',
    options: [],
    examples: [{ title: 'Stats', command: 'ptide words stats' }],
    run: async (): Promise<ToolResult> => {
      const categories = listCategories();
      const themes = listThemes();
      const unique = allWords().length;
      return {
        data: {
          categories: categories.length,
          themes: themes.length,
          uniqueWords: unique,
          source: 'puzzletide-cli starter word banks',
        },
        text: `${categories.length} categories · ${themes.length} themes · ${unique} unique words (starter banks; full collection at puzzletide.com)`,
      };
    },
  },
];
