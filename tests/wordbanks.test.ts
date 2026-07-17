import { describe, expect, it } from 'vitest';
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
} from '../src/data/wordbanks.js';

describe('wordbanks', () => {
  it('loads the bundled dataset', () => {
    expect(listCategories().length).toBeGreaterThanOrEqual(5);
    expect(listThemes().length).toBeGreaterThanOrEqual(25);
    expect(allWords().length).toBeGreaterThan(300);
  });

  it('finds themes by id and slug', () => {
    const byId = findTheme('animals/ocean-animals');
    expect(byId?.title).toBe('Ocean Animals');
    expect(byId?.words.length).toBeGreaterThan(5);
  });

  it('searches themes', () => {
    const results = searchThemes('ocean');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.id === 'animals/ocean-animals')).toBe(true);
  });

  it('picks words deterministically with a seed', () => {
    const theme = findTheme('animals/ocean-animals')!;
    const a = pickThemeWords(theme, { count: 5, seed: 9 });
    const b = pickThemeWords(theme, { count: 5, seed: 9 });
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });

  it('filters by length', () => {
    const theme = findTheme('animals/ocean-animals')!;
    const words = pickThemeWords(theme, { maxLength: 6 });
    for (const word of words) {
      expect(word.replace(/[\s-]/g, '').length).toBeLessThanOrEqual(6);
    }
  });

  it('matches crossword patterns', () => {
    const matches = matchPattern('c_r_l');
    expect(matches).toContain('CORAL');
    for (const match of matches) {
      expect(match).toHaveLength(5);
      expect(match[0]).toBe('C');
      expect(match[2]).toBe('R');
      expect(match[4]).toBe('L');
    }
  });

  it('finds anagrams', () => {
    const anagrams = findAnagrams('coral');
    expect(anagrams).toContain('CAROL');
  });

  it('picks a reproducible random word', () => {
    const a = randomWord({ theme: 'animals/zoo-animals', seed: 4 });
    const b = randomWord({ theme: 'animals/zoo-animals', seed: 4 });
    expect(a.word).toBe(b.word);
    expect(a.theme.id).toBe('animals/zoo-animals');
  });
});
