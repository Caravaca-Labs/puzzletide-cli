/**
 * Hangman game logic, plus a letter-frequency best-guess helper for hints.
 */

export interface HangmanGameState {
  word: string;
  guessedLetters: Set<string>;
  wrongGuesses: number;
  maxWrongGuesses: number;
}

export interface HangmanRevealResult {
  revealedPositions: number[];
  isCorrectGuess: boolean;
}

export interface HangmanGameStatus {
  isWon: boolean;
  isLost: boolean;
  isComplete: boolean;
}

export const MAX_WRONG_GUESSES = 6;

export function createHangmanGame(word: string): HangmanGameState {
  return {
    word,
    guessedLetters: new Set(),
    wrongGuesses: 0,
    maxWrongGuesses: MAX_WRONG_GUESSES,
  };
}

export function revealLetter(word: string, letter: string): HangmanRevealResult {
  const normalizedLetter = letter.toUpperCase();
  const normalizedWord = word.toUpperCase();

  const revealedPositions: number[] = [];

  for (let i = 0; i < normalizedWord.length; i++) {
    if (normalizedWord[i] === normalizedLetter) {
      revealedPositions.push(i);
    }
  }

  return {
    revealedPositions,
    isCorrectGuess: revealedPositions.length > 0,
  };
}

export function processGuess(
  state: HangmanGameState,
  letter: string
): { state: HangmanGameState; result: HangmanRevealResult } {
  const normalizedLetter = letter.toUpperCase();

  if (state.guessedLetters.has(normalizedLetter)) {
    return {
      state,
      result: { revealedPositions: [], isCorrectGuess: false },
    };
  }

  const newGuessedLetters = new Set(state.guessedLetters);
  newGuessedLetters.add(normalizedLetter);

  const revealResult = revealLetter(state.word, normalizedLetter);

  const newWrongGuesses = revealResult.isCorrectGuess
    ? state.wrongGuesses
    : state.wrongGuesses + 1;

  return {
    state: {
      ...state,
      guessedLetters: newGuessedLetters,
      wrongGuesses: newWrongGuesses,
    },
    result: revealResult,
  };
}

export function checkWinCondition(state: HangmanGameState): boolean {
  const normalizedWord = state.word.toUpperCase();
  const uniqueLetters = new Set(normalizedWord.split('').filter((c) => /[A-Z]/.test(c)));

  for (const letter of uniqueLetters) {
    if (!state.guessedLetters.has(letter)) {
      return false;
    }
  }

  return true;
}

export function checkLoseCondition(state: HangmanGameState): boolean {
  return state.wrongGuesses >= state.maxWrongGuesses && !checkWinCondition(state);
}

export function getGameStatus(state: HangmanGameState): HangmanGameStatus {
  const isWon = checkWinCondition(state);
  const isLost = checkLoseCondition(state);

  return {
    isWon,
    isLost,
    isComplete: isWon || isLost,
  };
}

/** Revealed word with blanks for unguessed letters, e.g. "C _ T". */
export function getRevealedWord(state: HangmanGameState): string {
  const normalizedWord = state.word.toUpperCase();
  const revealed: string[] = [];

  for (let i = 0; i < normalizedWord.length; i++) {
    const letter = normalizedWord[i];
    if (!/[A-Z]/.test(letter) || state.guessedLetters.has(letter)) {
      revealed.push(letter);
    } else {
      revealed.push('_');
    }
  }

  return revealed.join(' ');
}

/**
 * Suggests the next guess: the most frequent unguessed letter across
 * candidate words that still match the revealed pattern.
 */
export function bestGuess(
  pattern: string,
  guessed: Set<string>,
  candidates: string[]
): string | null {
  const normalizedPattern = pattern.toUpperCase().replace(/\s+/g, '');
  const regex = new RegExp(
    `^${normalizedPattern
      .split('')
      .map((c) => (c === '_' ? '[A-Z]' : c.replace(/[^A-Z]/g, '\\$&')))
      .join('')}$`
  );

  const matching = candidates
    .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length === normalizedPattern.length && regex.test(w))
    // Words containing an already-guessed wrong letter are impossible.
    .filter((w) => {
      for (const g of guessed) {
        if (!normalizedPattern.includes(g) && w.includes(g)) {
          return false;
        }
      }
      return true;
    });

  const counts = new Map<string, number>();
  for (const word of matching) {
    for (const letter of new Set(word.split(''))) {
      if (!guessed.has(letter) && !normalizedPattern.includes(letter)) {
        counts.set(letter, (counts.get(letter) ?? 0) + 1);
      }
    }
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [letter, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && letter < best)) {
      best = letter;
      bestCount = count;
    }
  }

  return best;
}
