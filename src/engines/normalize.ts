/**
 * Word normalization for puzzle grid placement.
 * - Converts to uppercase
 * - Removes spaces and hyphens
 * - Removes diacritics (accents)
 */
export function normalizeWord(word: string): string {
  if (!word) {
    return '';
  }

  const withoutDiacritics = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return withoutDiacritics.toUpperCase().replace(/[\s-]/g, '');
}

/** Crossword-style normalization: uppercase A-Z only. */
export function normalizeCrosswordWord(word: string): string {
  return normalizeWord(word).replace(/[^A-Z]/g, '');
}
