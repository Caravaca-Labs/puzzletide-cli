/** SVG renderers: self-contained printable vector output for each puzzle. */

import type { CrosswordPuzzle, WordSearchPuzzle } from '../engines/types.js';
import { assignClueNumbers } from '../engines/crossword.js';

const FONT_STACK = 'Helvetica, Arial, sans-serif';
const INK = '#1f2937';
const LIGHT = '#9ca3af';
const HIGHLIGHT = '#93c5fd';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgDocument(width: number, height: number, body: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="white"/>`,
    body,
    '</svg>',
  ].join('\n');
}

export function wordSearchSvg(
  puzzle: WordSearchPuzzle,
  options: { solution?: boolean; title?: string } = {}
): string {
  const cell = 32;
  const margin = 40;
  const titleSpace = options.title ? 48 : 0;
  const gridWidth = puzzle.cols * cell;
  const gridHeight = puzzle.rows * cell;
  const words = [...puzzle.words].map((w) => w.displayWord).sort((a, b) => a.localeCompare(b));
  const wordColumns = 3;
  const wordRows = Math.ceil(words.length / wordColumns);
  const listHeight = wordRows * 20 + 40;

  const width = Math.max(gridWidth + margin * 2, 480);
  const height = margin + titleSpace + gridHeight + listHeight + margin;
  const offsetX = (width - gridWidth) / 2;
  const offsetY = margin + titleSpace;

  const parts: string[] = [];

  if (options.title) {
    parts.push(
      `<text x="${width / 2}" y="${margin + 8}" font-family="${FONT_STACK}" font-size="24" font-weight="bold" fill="${INK}" text-anchor="middle">${escapeXml(options.title)}</text>`
    );
  }

  // Solution highlights behind the letters.
  if (options.solution) {
    for (const word of puzzle.words) {
      const x1 = offsetX + word.startCol * cell + cell / 2;
      const y1 = offsetY + word.startRow * cell + cell / 2;
      const x2 = offsetX + word.endCol * cell + cell / 2;
      const y2 = offsetY + word.endRow * cell + cell / 2;
      parts.push(
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${HIGHLIGHT}" stroke-width="${cell * 0.7}" stroke-linecap="round" opacity="0.55"/>`
      );
    }
  }

  parts.push(
    `<rect x="${offsetX}" y="${offsetY}" width="${gridWidth}" height="${gridHeight}" fill="none" stroke="${INK}" stroke-width="2"/>`
  );

  for (let row = 0; row < puzzle.rows; row++) {
    for (let col = 0; col < puzzle.cols; col++) {
      const letter = puzzle.grid[row][col];
      if (!letter) continue;
      parts.push(
        `<text x="${offsetX + col * cell + cell / 2}" y="${offsetY + row * cell + cell / 2 + 6}" font-family="${FONT_STACK}" font-size="17" fill="${INK}" text-anchor="middle">${escapeXml(letter)}</text>`
      );
    }
  }

  const listY = offsetY + gridHeight + 32;
  parts.push(
    `<text x="${offsetX}" y="${listY}" font-family="${FONT_STACK}" font-size="14" font-weight="bold" fill="${INK}">Find these words:</text>`
  );
  const columnWidth = gridWidth / wordColumns;
  words.forEach((word, index) => {
    const col = index % wordColumns;
    const row = Math.floor(index / wordColumns);
    parts.push(
      `<text x="${offsetX + col * columnWidth}" y="${listY + 22 + row * 20}" font-family="${FONT_STACK}" font-size="13" fill="${INK}">${escapeXml(word)}</text>`
    );
  });

  return svgDocument(width, height, parts.join('\n'));
}

export function sudokuSvg(
  grid: (number | null)[][] | number[][],
  options: { title?: string; givens?: (number | null)[][] } = {}
): string {
  const cell = 48;
  const margin = 40;
  const titleSpace = options.title ? 48 : 0;
  const gridSize = cell * 9;
  const width = gridSize + margin * 2;
  const height = gridSize + margin * 2 + titleSpace;
  const offsetX = margin;
  const offsetY = margin + titleSpace;

  const parts: string[] = [];

  if (options.title) {
    parts.push(
      `<text x="${width / 2}" y="${margin + 8}" font-family="${FONT_STACK}" font-size="24" font-weight="bold" fill="${INK}" text-anchor="middle">${escapeXml(options.title)}</text>`
    );
  }

  for (let i = 0; i <= 9; i++) {
    const thick = i % 3 === 0;
    const stroke = thick ? 2.5 : 1;
    parts.push(
      `<line x1="${offsetX}" y1="${offsetY + i * cell}" x2="${offsetX + gridSize}" y2="${offsetY + i * cell}" stroke="${INK}" stroke-width="${stroke}"/>`,
      `<line x1="${offsetX + i * cell}" y1="${offsetY}" x2="${offsetX + i * cell}" y2="${offsetY + gridSize}" stroke="${INK}" stroke-width="${stroke}"/>`
    );
  }

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = grid[row][col];
      if (value === null || value === 0) continue;
      const isGiven = options.givens ? options.givens[row][col] !== null : true;
      parts.push(
        `<text x="${offsetX + col * cell + cell / 2}" y="${offsetY + row * cell + cell / 2 + 8}" font-family="${FONT_STACK}" font-size="24" ${isGiven ? 'font-weight="bold"' : `fill="${LIGHT}"`} ${isGiven ? `fill="${INK}"` : ''} text-anchor="middle">${value}</text>`
      );
    }
  }

  return svgDocument(width, height, parts.join('\n'));
}

export function crosswordSvg(
  puzzle: Pick<CrosswordPuzzle, 'grid' | 'clues'>,
  options: { solution?: boolean; title?: string } = {}
): string {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const cell = 36;
  const margin = 40;
  const titleSpace = options.title ? 48 : 0;
  const gridWidth = cols * cell;
  const gridHeight = rows * cell;
  const width = Math.max(gridWidth + margin * 2, 400);
  const height = gridHeight + margin * 2 + titleSpace;
  const offsetX = (width - gridWidth) / 2;
  const offsetY = margin + titleSpace;
  const numbers = assignClueNumbers(puzzle.grid);

  const parts: string[] = [];

  if (options.title) {
    parts.push(
      `<text x="${width / 2}" y="${margin + 8}" font-family="${FONT_STACK}" font-size="24" font-weight="bold" fill="${INK}" text-anchor="middle">${escapeXml(options.title)}</text>`
    );
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellValue = puzzle.grid[row][col];
      const x = offsetX + col * cell;
      const y = offsetY + row * cell;

      if (cellValue === null) {
        continue;
      }

      parts.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="white" stroke="${INK}" stroke-width="1.2"/>`
      );

      const number = numbers.get(`${row},${col}`);
      if (number !== undefined) {
        parts.push(
          `<text x="${x + 3}" y="${y + 11}" font-family="${FONT_STACK}" font-size="9" fill="${INK}">${number}</text>`
        );
      }

      if (options.solution) {
        parts.push(
          `<text x="${x + cell / 2}" y="${y + cell / 2 + 7}" font-family="${FONT_STACK}" font-size="18" fill="${INK}" text-anchor="middle">${escapeXml(cellValue)}</text>`
        );
      }
    }
  }

  return svgDocument(width, height, parts.join('\n'));
}
