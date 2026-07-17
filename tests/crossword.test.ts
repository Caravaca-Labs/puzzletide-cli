import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  generateCrossword,
  validateClueGridConsistency,
} from '../src/engines/crossword.js';
import { generateBasicClue } from '../src/engines/clues.js';

const wordArb = fc.stringMatching(/^[a-zA-Z]{3,10}$/);

const entriesArb = fc
  .uniqueArray(wordArb, {
    minLength: 3,
    maxLength: 12,
    selector: (w) => w.toUpperCase(),
  })
  .map((words) => words.map((word) => ({ word, clue: generateBasicClue(word) })));

describe('generateCrossword', () => {
  it('produces a grid consistent with its clues (property)', () => {
    fc.assert(
      fc.property(entriesArb, fc.integer({ min: 0, max: 10000 }), (entries, seed) => {
        const puzzle = generateCrossword({ words: entries, seed });

        const consistency = validateClueGridConsistency(puzzle);
        expect(consistency.inconsistentClues).toEqual([]);

        // Every input word is either placed or reported unplaced.
        expect(puzzle.placedWords.length + puzzle.unplacedWords.length).toBe(entries.length);
        expect(puzzle.placedWords.length).toBeGreaterThan(0);
      }),
      { numRuns: 40 }
    );
  });

  it('assigns ascending clue numbers within each direction', () => {
    const puzzle = generateCrossword({
      words: [
        { word: 'PARIS', clue: 'Capital of France' },
        { word: 'TOKYO', clue: 'Capital of Japan' },
        { word: 'OSLO', clue: 'Capital of Norway' },
        { word: 'LIMA', clue: 'Capital of Peru' },
        { word: 'ROME', clue: 'Capital of Italy' },
      ],
      seed: 1,
    });

    for (const direction of ['across', 'down'] as const) {
      const numbers = puzzle.clues[direction].map((c) => c.number);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      for (const number of numbers) {
        expect(number).toBeGreaterThan(0);
      }
    }
  });

  it('trims the grid to its bounding box', () => {
    fc.assert(
      fc.property(entriesArb, fc.integer({ min: 0, max: 10000 }), (entries, seed) => {
        const { grid } = generateCrossword({ words: entries, seed });

        const rows = grid.length;
        const cols = grid[0]?.length ?? 0;
        expect(rows).toBeGreaterThan(0);
        expect(cols).toBeGreaterThan(0);

        const hasLetter = (cells: (string | null)[]) => cells.some((c) => c !== null);
        expect(hasLetter(grid[0])).toBe(true);
        expect(hasLetter(grid[rows - 1])).toBe(true);
        expect(hasLetter(grid.map((r) => r[0]))).toBe(true);
        expect(hasLetter(grid.map((r) => r[cols - 1]))).toBe(true);
      }),
      { numRuns: 25 }
    );
  });

  it('is deterministic for the same seed', () => {
    const entries = [
      { word: 'APPLE', clue: 'Fruit' },
      { word: 'PEAR', clue: 'Fruit' },
      { word: 'GRAPE', clue: 'Fruit' },
      { word: 'PLUM', clue: 'Fruit' },
    ];
    expect(generateCrossword({ words: entries, seed: 5 })).toEqual(
      generateCrossword({ words: entries, seed: 5 })
    );
  });

  it('throws when no words are usable', () => {
    expect(() => generateCrossword({ words: [{ word: 'a', clue: 'x' }], seed: 0 })).toThrow();
  });
});

describe('generateBasicClue', () => {
  it('never leaks the word itself', () => {
    fc.assert(
      fc.property(wordArb, (word) => {
        const clue = generateBasicClue(word);
        const normalized = word.toUpperCase();
        if (normalized.length > 2) {
          expect(clue.toUpperCase()).not.toContain(normalized);
        }
        expect(clue.length).toBeGreaterThan(0);
      })
    );
  });
});
