import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  extractPlacement,
  generateWordSearch,
  WordSearchError,
} from '../src/engines/wordsearch.js';
import { normalizeWord } from '../src/engines/normalize.js';
import { WORD_SEARCH_DIRECTION_PRESETS } from '../src/engines/types.js';

const wordArb = fc
  .stringMatching(/^[a-zA-Z]{3,9}$/)
  .map((s) => s.toLowerCase());

const wordListArb = fc.uniqueArray(wordArb, {
  minLength: 2,
  maxLength: 10,
  selector: (w) => normalizeWord(w),
});

describe('generateWordSearch', () => {
  it('places every word so it can be read from the grid (property)', () => {
    fc.assert(
      fc.property(wordListArb, fc.integer({ min: 1, max: 100000 }), (words, seed) => {
        const puzzle = generateWordSearch({
          words,
          directions: WORD_SEARCH_DIRECTION_PRESETS.hard,
          seed,
        });

        expect(puzzle.words).toHaveLength(words.length);

        for (const placed of puzzle.words) {
          const extracted = extractPlacement(puzzle.grid, placed);
          expect(extracted).toBe(placed.normalizedWord);
        }
      }),
      { numRuns: 40 }
    );
  });

  it('fills every cell with a letter', () => {
    const puzzle = generateWordSearch({
      words: ['coral', 'shark', 'kelp'],
      directions: WORD_SEARCH_DIRECTION_PRESETS.medium,
      seed: 7,
    });

    for (const row of puzzle.grid) {
      for (const cell of row) {
        expect(cell).toMatch(/^[A-Z]$/);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const make = () =>
      generateWordSearch({
        words: ['whale', 'squid', 'urchin', 'anemone'],
        directions: WORD_SEARCH_DIRECTION_PRESETS.hard,
        seed: 12345,
      });

    expect(make()).toEqual(make());
  });

  it('respects the allowed directions', () => {
    fc.assert(
      fc.property(wordListArb, fc.integer({ min: 1, max: 100000 }), (words, seed) => {
        const puzzle = generateWordSearch({
          words,
          directions: WORD_SEARCH_DIRECTION_PRESETS.easy,
          seed,
        });
        for (const placed of puzzle.words) {
          expect(['E', 'S']).toContain(placed.direction);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('throws a clear error when a word cannot fit', () => {
    expect(() =>
      generateWordSearch({
        words: ['extraordinarily'],
        rows: 8,
        cols: 8,
        directions: WORD_SEARCH_DIRECTION_PRESETS.easy,
        seed: 1,
      })
    ).toThrow(WordSearchError);
  });

  it('normalizes accents, spaces, and hyphens for placement', () => {
    const puzzle = generateWordSearch({
      words: ['Sea Lion', 'Crème-Brûlée'],
      directions: WORD_SEARCH_DIRECTION_PRESETS.medium,
      seed: 3,
    });

    const normalized = puzzle.words.map((w) => w.normalizedWord).sort();
    expect(normalized).toEqual(['CREMEBRULEE', 'SEALION']);
  });
});
