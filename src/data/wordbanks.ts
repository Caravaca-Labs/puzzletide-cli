/**
 * Loader for the bundled starter word banks (data/wordbanks.json, compiled
 * from scripts/wordbanks-source.json — generic lists written for this
 * package; the full curated collection lives at puzzletide.com).
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { SeededRandom } from '../core/rng.js';
import { normalizeWord } from '../engines/normalize.js';

export interface WordbankTheme {
  id: string;
  category: string;
  title: string;
  difficulty: string;
  description: string;
  words: string[];
}

export interface WordbankCategory {
  slug: string;
  title: string;
  themes: number;
}

interface WordbankPayload {
  source: string;
  categories: WordbankCategory[];
  themes: WordbankTheme[];
}

let cached: WordbankPayload | null = null;

function load(): WordbankPayload {
  if (!cached) {
    const require = createRequire(import.meta.url);
    const file = require.resolve('../../data/wordbanks.json');
    cached = JSON.parse(fs.readFileSync(file, 'utf8')) as WordbankPayload;
  }
  return cached;
}

export function listCategories(): WordbankCategory[] {
  return load().categories;
}

export function listThemes(category?: string): WordbankTheme[] {
  const themes = load().themes;
  if (!category) {
    return themes;
  }
  return themes.filter((t) => t.category === category);
}

/** Finds a theme by exact id ("animals/ocean-animals") or unique slug/title. */
export function findTheme(query: string): WordbankTheme | null {
  const themes = load().themes;
  const normalized = query.trim().toLowerCase();

  const byId = themes.find((t) => t.id.toLowerCase() === normalized);
  if (byId) return byId;

  const slugMatches = themes.filter((t) => t.id.split('/')[1] === normalized);
  if (slugMatches.length === 1) return slugMatches[0];

  const titleMatches = themes.filter((t) => t.title.toLowerCase() === normalized);
  if (titleMatches.length === 1) return titleMatches[0];

  return null;
}

export function searchThemes(query: string, limit = 25): WordbankTheme[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const themes = load().themes;
  const scored = themes
    .map((t) => {
      const haystack = `${t.id} ${t.title} ${t.description}`.toLowerCase();
      let score = 0;
      if (t.id.toLowerCase().includes(normalized)) score += 3;
      if (t.title.toLowerCase().includes(normalized)) score += 2;
      if (haystack.includes(normalized)) score += 1;
      return { theme: t, score };
    })
    .filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score || a.theme.id.localeCompare(b.theme.id));
  return scored.slice(0, limit).map((s) => s.theme);
}

export interface PickWordsOptions {
  count?: number;
  maxLength?: number;
  minLength?: number;
  seed?: number;
}

/** Picks words from a theme, optionally filtered by normalized length. */
export function pickThemeWords(theme: WordbankTheme, options: PickWordsOptions = {}): string[] {
  let words = theme.words.filter((w) => normalizeWord(w).length >= 2);

  if (options.minLength) {
    words = words.filter((w) => normalizeWord(w).length >= (options.minLength as number));
  }
  if (options.maxLength) {
    words = words.filter((w) => normalizeWord(w).length <= (options.maxLength as number));
  }

  if (options.seed !== undefined) {
    words = new SeededRandom(options.seed).shuffle(words);
  }

  if (options.count && options.count < words.length) {
    words = words.slice(0, options.count);
  }

  return words;
}

let uniqueWordsCache: string[] | null = null;

/** All unique words across every theme, normalized to uppercase A-Z. */
export function allWords(): string[] {
  if (!uniqueWordsCache) {
    const seen = new Set<string>();
    for (const theme of load().themes) {
      for (const word of theme.words) {
        const normalized = normalizeWord(word).replace(/[^A-Z]/g, '');
        if (normalized.length >= 2) {
          seen.add(normalized);
        }
      }
    }
    uniqueWordsCache = [...seen].sort();
  }
  return uniqueWordsCache;
}

/** Matches wordbank words against a pattern: "_" or "?" = any letter. */
export function matchPattern(pattern: string, limit = 100): string[] {
  const normalized = pattern.toUpperCase().replace(/[?.]/g, '_').replace(/[^A-Z_]/g, '');
  if (normalized.length === 0) return [];

  const regex = new RegExp(`^${normalized.split('').map((c) => (c === '_' ? '[A-Z]' : c)).join('')}$`);
  return allWords()
    .filter((w) => w.length === normalized.length && regex.test(w))
    .slice(0, limit);
}

/** Finds single-word anagrams of the given letters in the word bank. */
export function findAnagrams(letters: string, limit = 100): string[] {
  const normalized = normalizeWord(letters).replace(/[^A-Z]/g, '');
  if (normalized.length < 2) return [];

  const key = normalized.split('').sort().join('');
  return allWords()
    .filter((w) => w.length === key.length && w !== normalized && w.split('').sort().join('') === key)
    .slice(0, limit);
}

/** Picks a random word, optionally from one theme, suitable for hangman. */
export function randomWord(options: { theme?: string; seed?: number; minLength?: number } = {}): {
  word: string;
  theme: WordbankTheme;
} {
  const minLength = options.minLength ?? 4;
  const themes = options.theme
    ? [findTheme(options.theme)].filter((t): t is WordbankTheme => t !== null)
    : listThemes();

  if (themes.length === 0) {
    throw new Error(`Unknown theme: ${options.theme}`);
  }

  const rng = new SeededRandom(options.seed ?? Math.floor(Math.random() * 0x7ffffffe) + 1);

  // Up to a few attempts to find a theme with usable words.
  for (let attempt = 0; attempt < 20; attempt++) {
    const theme = rng.pick(themes);
    const usable = theme.words.filter((w) => {
      const normalized = normalizeWord(w).replace(/[^A-Z]/g, '');
      return normalized.length >= minLength && /^[A-Z]+$/.test(normalized);
    });
    if (usable.length > 0) {
      return { word: rng.pick(usable), theme };
    }
  }

  throw new Error('Could not find a usable word in the word bank.');
}
