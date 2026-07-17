import { describe, expect, it } from 'vitest';
import { generateWordSearch } from '../src/engines/wordsearch.js';
import { generateCrossword } from '../src/engines/crossword.js';
import { generateSudoku } from '../src/engines/sudoku.js';
import { WORD_SEARCH_DIRECTION_PRESETS } from '../src/engines/types.js';
import { crosswordAscii, sudokuAscii, wordSearchAscii } from '../src/render/ascii.js';
import { crosswordSvg, sudokuSvg, wordSearchSvg } from '../src/render/svg.js';
import { crosswordPdf, sudokuPdf, wordSearchPdf } from '../src/render/pdf.js';

const wordSearch = generateWordSearch({
  words: ['coral', 'shark', 'kelp', 'wave'],
  directions: WORD_SEARCH_DIRECTION_PRESETS.medium,
  seed: 42,
});

const crossword = generateCrossword({
  words: [
    { word: 'PARIS', clue: 'Capital of France' },
    { word: 'TOKYO', clue: 'Capital of Japan' },
    { word: 'OSLO', clue: 'Capital of Norway' },
  ],
  seed: 1,
});

const sudoku = generateSudoku({ difficulty: 'easy', seed: 7 });

describe('ascii renderers', () => {
  it('renders a word search grid with the word list', () => {
    const text = wordSearchAscii(wordSearch);
    expect(text).toContain('Find these words:');
    expect(text).toContain('coral');
    // Grid rows have single-space separated letters.
    expect(text.split('\n')[0]).toMatch(/^([A-Z] )+[A-Z]$/);
  });

  it('renders sudoku with box separators', () => {
    const text = sudokuAscii(sudoku.puzzle);
    expect(text.split('\n')).toHaveLength(13);
    expect(text).toContain('+-------+-------+-------+');
  });

  it('renders crossword clues', () => {
    const text = crosswordAscii(crossword);
    expect(text).toContain('ACROSS');
    expect(text).toContain('DOWN');
    expect(text).toContain('Capital of France (5)');
    const solved = crosswordAscii(crossword, { solution: true });
    expect(solved).toContain('— PARIS');
  });
});

describe('svg renderers', () => {
  it('produces well-formed SVG for all puzzle types', () => {
    for (const svg of [
      wordSearchSvg(wordSearch, { title: 'Test' }),
      sudokuSvg(sudoku.puzzle, { title: 'Test' }),
      crosswordSvg(crossword, { title: 'Test' }),
    ]) {
      expect(svg).toMatch(/^<svg /);
      expect(svg).toMatch(/<\/svg>$/);
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });

  it('escapes XML in titles', () => {
    const svg = wordSearchSvg(wordSearch, { title: 'Cats & <Dogs>' });
    expect(svg).toContain('Cats &amp; &lt;Dogs&gt;');
  });
});

describe('pdf renderers', () => {
  it('produces valid PDFs with puzzle and solution pages', async () => {
    for (const bytes of [
      await wordSearchPdf(wordSearch, { title: 'Test' }),
      await sudokuPdf(sudoku, { title: 'Test' }),
      await crosswordPdf(crossword, { title: 'Test' }),
    ]) {
      const header = Buffer.from(bytes.slice(0, 5)).toString('ascii');
      expect(header).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(1000);
    }
  });

  it('supports a4 paper', async () => {
    const bytes = await sudokuPdf(sudoku, { paper: 'a4' });
    expect(Buffer.from(bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');
  });
});
