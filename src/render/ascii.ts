/** Terminal renderers for puzzles. */

import type { CrosswordPuzzle, PlacedWord, WordSearchPuzzle } from '../engines/types.js';
import { assignClueNumbers } from '../engines/crossword.js';

export function wordSearchAscii(
  puzzle: WordSearchPuzzle,
  options: { solution?: boolean } = {}
): string {
  const solutionCells = new Set<string>();
  if (options.solution) {
    for (const word of puzzle.words) {
      for (const cell of placementCells(word)) {
        solutionCells.add(cell);
      }
    }
  }

  const lines: string[] = [];
  for (let row = 0; row < puzzle.rows; row++) {
    const cells: string[] = [];
    for (let col = 0; col < puzzle.cols; col++) {
      const letter = puzzle.grid[row][col] || '·';
      if (options.solution) {
        cells.push(solutionCells.has(`${row},${col}`) ? letter : '·');
      } else {
        cells.push(letter);
      }
    }
    lines.push(cells.join(' '));
  }

  const words = [...puzzle.words]
    .map((w) => w.displayWord)
    .sort((a, b) => a.localeCompare(b));

  lines.push('');
  lines.push(options.solution ? 'Solution word list:' : 'Find these words:');
  lines.push(...columnize(words, 3, 24));

  return lines.join('\n');
}

function placementCells(word: PlacedWord): string[] {
  const rowDelta = Math.sign(word.endRow - word.startRow);
  const colDelta = Math.sign(word.endCol - word.startCol);
  const steps = Math.max(
    Math.abs(word.endRow - word.startRow),
    Math.abs(word.endCol - word.startCol)
  );

  const cells: string[] = [];
  for (let i = 0; i <= steps; i++) {
    cells.push(`${word.startRow + rowDelta * i},${word.startCol + colDelta * i}`);
  }
  return cells;
}

export function sudokuAscii(grid: (number | null)[][] | number[][]): string {
  const lines: string[] = [];
  const horizontal = '+-------+-------+-------+';

  for (let row = 0; row < 9; row++) {
    if (row % 3 === 0) {
      lines.push(horizontal);
    }
    let line = '|';
    for (let col = 0; col < 9; col++) {
      const value = grid[row][col];
      line += ` ${value === null || value === 0 ? '.' : String(value)}`;
      if (col % 3 === 2) {
        line += ' |';
      }
    }
    lines.push(line);
  }
  lines.push(horizontal);

  return lines.join('\n');
}

export function crosswordAscii(
  puzzle: Pick<CrosswordPuzzle, 'grid' | 'clues'>,
  options: { solution?: boolean } = {}
): string {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const numbers = assignClueNumbers(puzzle.grid);

  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    const cells: string[] = [];
    for (let col = 0; col < cols; col++) {
      const cell = puzzle.grid[row][col];
      if (cell === null) {
        cells.push('███');
      } else if (options.solution) {
        cells.push(` ${cell} `);
      } else {
        const number = numbers.get(`${row},${col}`);
        cells.push(number !== undefined ? String(number).padStart(2, ' ') + '·' : ' · ');
      }
    }
    lines.push(cells.join(''));
  }

  lines.push('');
  lines.push('ACROSS');
  for (const clue of puzzle.clues.across) {
    lines.push(
      `  ${clue.number}. ${clue.clue}${options.solution ? ` — ${clue.answer}` : ` (${clue.length})`}`
    );
  }
  lines.push('');
  lines.push('DOWN');
  for (const clue of puzzle.clues.down) {
    lines.push(
      `  ${clue.number}. ${clue.clue}${options.solution ? ` — ${clue.answer}` : ` (${clue.length})`}`
    );
  }

  return lines.join('\n');
}

/** Lays out short strings in fixed-width columns. */
export function columnize(items: string[], columns: number, width: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += columns) {
    lines.push(
      items
        .slice(i, i + columns)
        .map((item, idx, arr) => (idx < arr.length - 1 ? item.padEnd(width) : item))
        .join('')
        .trimEnd()
    );
  }
  return lines;
}
