/** Shared input/output helpers for tool implementations. */

import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../core/errors.js';
import { resolveSeed } from '../core/rng.js';
import { findTheme, pickThemeWords, type WordbankTheme } from '../data/wordbanks.js';
import { generateBasicClue } from '../engines/clues.js';
import type { CrosswordWordInput } from '../engines/crossword.js';
import type { PaperSize } from '../render/pdf.js';

export function readTextFile(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    throw new CliError(`Could not read file: ${file}`);
  }
}

export function writeFile(file: string, content: string | Uint8Array): void {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, content);
}

/** Splits an inline or file-based word list on commas and newlines. */
export function parseWordList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/**
 * Parses crossword word/clue entries.
 * Inline: "WORD: clue; WORD2: clue2" (semicolon- or newline-separated).
 * Files: JSON array of {word, clue} or "WORD: clue" lines. Words without a
 * clue get a deterministic puzzle-style fallback clue.
 */
export function parseWordClueList(value: string): CrosswordWordInput[] {
  const trimmed = value.trim();

  if (trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new CliError('Invalid JSON word list. Expected an array of {word, clue} objects.');
    }
    if (!Array.isArray(parsed)) {
      throw new CliError('Invalid JSON word list. Expected an array of {word, clue} objects.');
    }
    return parsed.map((entry) => {
      if (typeof entry === 'string') {
        return { word: entry, clue: generateBasicClue(entry) };
      }
      const obj = entry as { word?: unknown; clue?: unknown };
      if (typeof obj.word !== 'string' || obj.word.length === 0) {
        throw new CliError('Each JSON entry needs a "word" string.');
      }
      return {
        word: obj.word,
        clue: typeof obj.clue === 'string' && obj.clue.length > 0 ? obj.clue : generateBasicClue(obj.word),
      };
    });
  }

  return trimmed
    .split(/[\n;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const colon = entry.indexOf(':');
      if (colon === -1) {
        return { word: entry, clue: generateBasicClue(entry) };
      }
      const word = entry.slice(0, colon).trim();
      const clue = entry.slice(colon + 1).trim();
      return { word, clue: clue.length > 0 ? clue : generateBasicClue(word) };
    });
}

export interface ResolvedWordInput {
  words: string[];
  theme: WordbankTheme | null;
}

/** Resolves the word list for a generator from --words, --file, or --theme. */
export function resolveWords(options: {
  words?: string;
  file?: string;
  theme?: string;
  count?: number;
  minLength?: number;
  maxLength?: number;
  seed: number;
}): ResolvedWordInput {
  const sources = [options.words, options.file, options.theme].filter(Boolean).length;
  if (sources === 0) {
    throw new CliError(
      'No words provided.',
      'Pass --words "cat,dog,fish", --file words.txt, or --theme animals/ocean-animals (see: ptide words themes).'
    );
  }
  if (sources > 1) {
    throw new CliError('Pass only one of --words, --file, or --theme.');
  }

  if (options.theme) {
    const theme = findTheme(options.theme);
    if (!theme) {
      throw new CliError(
        `Unknown theme: ${options.theme}`,
        'List themes with: ptide words themes --search <query>'
      );
    }
    const words = pickThemeWords(theme, {
      count: options.count ?? 12,
      minLength: options.minLength,
      maxLength: options.maxLength,
      seed: options.seed,
    });
    if (words.length === 0) {
      throw new CliError(`Theme "${theme.id}" has no words matching the filters.`);
    }
    return { words, theme };
  }

  const raw = options.file ? readTextFile(options.file) : (options.words as string);
  let words = parseWordList(raw);
  if (options.count && options.count < words.length) {
    words = words.slice(0, options.count);
  }
  if (words.length === 0) {
    throw new CliError('The word list is empty.');
  }
  return { words, theme: null };
}

export function parseIntOption(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`${name} must be a positive integer.`);
  }
  return parsed;
}

export function parsePaper(value: unknown): PaperSize {
  if (value === undefined) return 'letter';
  if (value === 'letter' || value === 'a4') return value;
  throw new CliError('--paper must be "letter" or "a4".');
}

export function seedFromOptions(options: Record<string, unknown>): number {
  return resolveSeed(options.seed as string | number | undefined);
}

/** Reads grid text from a positional argument, --file, or stdin ("-"). */
export function readGridInput(positional: string | undefined, file: unknown): string {
  if (typeof file === 'string' && file.length > 0) {
    return readTextFile(file);
  }
  if (positional === '-' || (positional === undefined && !process.stdin.isTTY)) {
    try {
      return fs.readFileSync(0, 'utf8');
    } catch {
      throw new CliError('Could not read from stdin.');
    }
  }
  if (positional !== undefined) {
    return positional;
  }
  throw new CliError(
    'No grid provided.',
    'Pass the grid inline, with --file <path>, or pipe it via stdin.'
  );
}
