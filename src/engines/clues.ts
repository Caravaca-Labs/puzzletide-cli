/**
 * Deterministic clue generation for crossword words. No network access:
 * clues are puzzle-style hints (unscramble, letter counts, partial reveals).
 */

import { normalizeCrosswordWord } from './normalize.js';

export function generateBasicClue(word: string): string {
  const normalized = normalizeCrosswordWord(word);

  if (normalized.length === 0) {
    return 'Unknown word';
  }

  const strategies = [
    () => `Unscramble: ${scrambleWord(normalized)}`,
    () => `${normalized.length}-letter word starting with "${normalized[0]}"`,
    () => {
      if (normalized.length >= 3) {
        return `Starts with "${normalized[0]}", ends with "${normalized[normalized.length - 1]}" (${normalized.length} letters)`;
      }
      return `${normalized.length}-letter word`;
    },
    () => {
      const hidden = normalized
        .split('')
        .map((c, i) => (i === 0 || i === normalized.length - 1 ? c : '_'))
        .join(' ');
      return `Fill in: ${hidden}`;
    },
  ];

  const strategyIndex = normalized.length % strategies.length;
  return strategies[strategyIndex]();
}

/** Scrambles a word deterministically so the same word gets the same clue. */
function scrambleWord(word: string): string {
  const chars = word.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = (word.charCodeAt(i) + word.charCodeAt(0)) % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const scrambled = chars.join('');
  // A scramble that lands back on the original word is a giveaway; rotate.
  if (scrambled === word && word.length > 1) {
    return word.slice(1) + word[0];
  }
  return scrambled;
}
