/**
 * Seeded pseudo-random number generator (simple LCG) shared by all engines
 * so every puzzle is reproducible.
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    // Keep the state positive and non-zero regardless of input.
    this.seed = Math.abs(Math.floor(seed)) % 0x7fffffff || 1;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  pick<T>(array: readonly T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

/** Hashes an arbitrary string into a 31-bit seed (FNV-1a). */
export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % 0x7fffffff || 1;
}

/** Resolves a user-supplied seed (number, numeric string, or word) or draws one. */
export function resolveSeed(input?: string | number): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.abs(Math.floor(input)) % 0x7fffffff || 1;
  }
  if (typeof input === 'string' && input.length > 0) {
    const numeric = Number(input);
    if (Number.isFinite(numeric)) {
      return Math.abs(Math.floor(numeric)) % 0x7fffffff || 1;
    }
    return hashSeed(input);
  }
  return (Math.floor(Math.random() * 0x7ffffffe) + 1) % 0x7fffffff;
}

/** Deterministic seed for "daily" puzzles: one per UTC calendar day. */
export function dailySeed(date: Date = new Date()): number {
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  return hashSeed(`puzzletide-daily-${key}`);
}
