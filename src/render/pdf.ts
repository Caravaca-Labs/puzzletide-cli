/**
 * Printable PDF worksheets via pdf-lib: a puzzle page (grid + word list or
 * clues) and a solution page, with a puzzletide.com footer.
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { CrosswordPuzzle, WordSearchPuzzle } from '../engines/types.js';
import { assignClueNumbers } from '../engines/crossword.js';

export type PaperSize = 'letter' | 'a4';

const PAPER: Record<PaperSize, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
};

const INK = rgb(0.12, 0.16, 0.22);
const GRAY = rgb(0.62, 0.65, 0.69);
const HIGHLIGHT = rgb(0.58, 0.77, 0.99);

interface PdfContext {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  paper: { width: number; height: number };
}

async function createContext(paperSize: PaperSize): Promise<PdfContext> {
  const doc = await PDFDocument.create();
  doc.setProducer('puzzletide CLI');
  doc.setCreator('puzzletide CLI — https://puzzletide.com');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, font, bold, paper: PAPER[paperSize] };
}

function addPage(ctx: PdfContext, title: string, subtitle?: string): { page: PDFPage; top: number } {
  const page = ctx.doc.addPage([ctx.paper.width, ctx.paper.height]);
  const { width, height } = ctx.paper;

  const titleSize = 22;
  const titleWidth = ctx.bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 60,
    size: titleSize,
    font: ctx.bold,
    color: INK,
  });

  let top = height - 80;
  if (subtitle) {
    const subSize = 11;
    const subWidth = ctx.font.widthOfTextAtSize(subtitle, subSize);
    page.drawText(subtitle, {
      x: (width - subWidth) / 2,
      y: top,
      size: subSize,
      font: ctx.font,
      color: GRAY,
    });
    top -= 24;
  }

  const footer = 'Made with the PuzzleTide CLI  ·  more free puzzles at puzzletide.com';
  const footerSize = 9;
  const footerWidth = ctx.font.widthOfTextAtSize(footer, footerSize);
  page.drawText(footer, {
    x: (width - footerWidth) / 2,
    y: 30,
    size: footerSize,
    font: ctx.font,
    color: GRAY,
  });

  return { page, top };
}

// ----------------------------------------------------------------------------
// Word search
// ----------------------------------------------------------------------------

export async function wordSearchPdf(
  puzzle: WordSearchPuzzle,
  options: { title?: string; paper?: PaperSize; includeSolution?: boolean } = {}
): Promise<Uint8Array> {
  const ctx = await createContext(options.paper ?? 'letter');
  const title = options.title ?? 'Word Search';

  drawWordSearchPage(ctx, puzzle, title, false);
  if (options.includeSolution !== false) {
    drawWordSearchPage(ctx, puzzle, `${title} — Solution`, true);
  }

  return ctx.doc.save();
}

function drawWordSearchPage(
  ctx: PdfContext,
  puzzle: WordSearchPuzzle,
  title: string,
  solution: boolean
): void {
  const { page, top } = addPage(ctx, title);
  const { width } = ctx.paper;

  const margin = 60;
  const words = [...puzzle.words].map((w) => w.displayWord).sort((a, b) => a.localeCompare(b));
  const wordColumns = 3;
  const wordRows = Math.ceil(words.length / wordColumns);
  const listHeight = wordRows * 16 + 36;

  const maxGridWidth = width - margin * 2;
  const maxGridHeight = top - 60 - listHeight - 40;
  const cell = Math.min(maxGridWidth / puzzle.cols, maxGridHeight / puzzle.rows, 30);
  const gridWidth = cell * puzzle.cols;
  const gridHeight = cell * puzzle.rows;
  const offsetX = (width - gridWidth) / 2;
  const offsetY = top - 20 - gridHeight;

  // Solution highlights beneath the letters.
  if (solution) {
    for (const word of puzzle.words) {
      const x1 = offsetX + word.startCol * cell + cell / 2;
      const y1 = offsetY + gridHeight - (word.startRow * cell + cell / 2);
      const x2 = offsetX + word.endCol * cell + cell / 2;
      const y2 = offsetY + gridHeight - (word.endRow * cell + cell / 2);
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: cell * 0.7,
        color: HIGHLIGHT,
        opacity: 0.5,
      });
    }
  }

  page.drawRectangle({
    x: offsetX,
    y: offsetY,
    width: gridWidth,
    height: gridHeight,
    borderColor: INK,
    borderWidth: 1.5,
  });

  const letterSize = cell * 0.55;
  for (let row = 0; row < puzzle.rows; row++) {
    for (let col = 0; col < puzzle.cols; col++) {
      const letter = puzzle.grid[row][col];
      if (!letter) continue;
      const letterWidth = ctx.font.widthOfTextAtSize(letter, letterSize);
      page.drawText(letter, {
        x: offsetX + col * cell + (cell - letterWidth) / 2,
        y: offsetY + gridHeight - (row + 1) * cell + cell * 0.28,
        size: letterSize,
        font: ctx.font,
        color: INK,
      });
    }
  }

  let listY = offsetY - 30;
  page.drawText(solution ? 'Word list:' : 'Find these words:', {
    x: margin,
    y: listY,
    size: 12,
    font: ctx.bold,
    color: INK,
  });
  listY -= 20;

  const columnWidth = (width - margin * 2) / wordColumns;
  words.forEach((word, index) => {
    const col = index % wordColumns;
    const row = Math.floor(index / wordColumns);
    page.drawText(word, {
      x: margin + col * columnWidth,
      y: listY - row * 16,
      size: 11,
      font: ctx.font,
      color: INK,
    });
  });
}

// ----------------------------------------------------------------------------
// Sudoku
// ----------------------------------------------------------------------------

export async function sudokuPdf(
  puzzle: { puzzle: (number | null)[][]; solution: number[][]; difficulty: string },
  options: { title?: string; paper?: PaperSize; includeSolution?: boolean } = {}
): Promise<Uint8Array> {
  const ctx = await createContext(options.paper ?? 'letter');
  const title = options.title ?? 'Sudoku';
  const subtitle = `Difficulty: ${puzzle.difficulty}`;

  drawSudokuPage(ctx, puzzle.puzzle, null, title, subtitle);
  if (options.includeSolution !== false) {
    drawSudokuPage(ctx, puzzle.solution, puzzle.puzzle, `${title} — Solution`, subtitle);
  }

  return ctx.doc.save();
}

function drawSudokuPage(
  ctx: PdfContext,
  grid: (number | null)[][] | number[][],
  givens: (number | null)[][] | null,
  title: string,
  subtitle: string
): void {
  const { page, top } = addPage(ctx, title, subtitle);
  const { width } = ctx.paper;

  const cell = Math.min((width - 140) / 9, (top - 100) / 9, 46);
  const gridSize = cell * 9;
  const offsetX = (width - gridSize) / 2;
  const offsetY = top - 30 - gridSize;

  for (let i = 0; i <= 9; i++) {
    const thickness = i % 3 === 0 ? 2.2 : 0.8;
    page.drawLine({
      start: { x: offsetX, y: offsetY + i * cell },
      end: { x: offsetX + gridSize, y: offsetY + i * cell },
      thickness,
      color: INK,
    });
    page.drawLine({
      start: { x: offsetX + i * cell, y: offsetY },
      end: { x: offsetX + i * cell, y: offsetY + gridSize },
      thickness,
      color: INK,
    });
  }

  const digitSize = cell * 0.55;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = grid[row][col];
      if (value === null || value === 0) continue;
      const isGiven = givens ? givens[row][col] !== null : true;
      const font = isGiven ? ctx.bold : ctx.font;
      const digit = String(value);
      const digitWidth = font.widthOfTextAtSize(digit, digitSize);
      page.drawText(digit, {
        x: offsetX + col * cell + (cell - digitWidth) / 2,
        y: offsetY + gridSize - (row + 1) * cell + cell * 0.3,
        size: digitSize,
        font,
        color: isGiven ? INK : GRAY,
      });
    }
  }
}

// ----------------------------------------------------------------------------
// Crossword
// ----------------------------------------------------------------------------

export async function crosswordPdf(
  puzzle: Pick<CrosswordPuzzle, 'grid' | 'clues'>,
  options: { title?: string; paper?: PaperSize; includeSolution?: boolean } = {}
): Promise<Uint8Array> {
  const ctx = await createContext(options.paper ?? 'letter');
  const title = options.title ?? 'Crossword';

  drawCrosswordGridPage(ctx, puzzle, title, false);
  drawCrosswordCluePages(ctx, puzzle, title);
  if (options.includeSolution !== false) {
    drawCrosswordGridPage(ctx, puzzle, `${title} — Solution`, true);
  }

  return ctx.doc.save();
}

function drawCrosswordGridPage(
  ctx: PdfContext,
  puzzle: Pick<CrosswordPuzzle, 'grid' | 'clues'>,
  title: string,
  solution: boolean
): void {
  const { page, top } = addPage(ctx, title);
  const { width } = ctx.paper;

  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const numbers = assignClueNumbers(puzzle.grid);

  const cell = Math.min((width - 120) / cols, (top - 100) / rows, 34);
  const gridWidth = cell * cols;
  const gridHeight = cell * rows;
  const offsetX = (width - gridWidth) / 2;
  const offsetY = top - 30 - gridHeight;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const value = puzzle.grid[row][col];
      if (value === null) continue;

      const x = offsetX + col * cell;
      const y = offsetY + gridHeight - (row + 1) * cell;

      page.drawRectangle({
        x,
        y,
        width: cell,
        height: cell,
        borderColor: INK,
        borderWidth: 0.9,
      });

      const number = numbers.get(`${row},${col}`);
      if (number !== undefined) {
        page.drawText(String(number), {
          x: x + 2.5,
          y: y + cell - 9,
          size: cell * 0.24,
          font: ctx.font,
          color: INK,
        });
      }

      if (solution) {
        const letterSize = cell * 0.52;
        const letterWidth = ctx.font.widthOfTextAtSize(value, letterSize);
        page.drawText(value, {
          x: x + (cell - letterWidth) / 2,
          y: y + cell * 0.22,
          size: letterSize,
          font: ctx.font,
          color: INK,
        });
      }
    }
  }
}

function drawCrosswordCluePages(
  ctx: PdfContext,
  puzzle: Pick<CrosswordPuzzle, 'grid' | 'clues'>,
  title: string
): void {
  const { width } = ctx.paper;
  const margin = 60;
  const columnGap = 24;
  const columnWidth = (width - margin * 2 - columnGap) / 2;
  const lineHeight = 14;
  const clueSize = 10;

  let { page, top } = addPage(ctx, `${title} — Clues`);
  let column = 0;
  let y = top - 10;

  const newColumn = () => {
    if (column === 0) {
      column = 1;
      y = top - 10;
    } else {
      ({ page, top } = addPage(ctx, `${title} — Clues (continued)`));
      column = 0;
      y = top - 10;
    }
  };

  const drawLine = (text: string, bold = false) => {
    if (y < 70) {
      newColumn();
    }
    page.drawText(text, {
      x: margin + column * (columnWidth + columnGap),
      y,
      size: bold ? 12 : clueSize,
      font: bold ? ctx.bold : ctx.font,
      color: INK,
    });
    y -= bold ? lineHeight + 4 : lineHeight;
  };

  for (const direction of ['across', 'down'] as const) {
    drawLine(direction.toUpperCase(), true);
    for (const clue of puzzle.clues[direction]) {
      const label = `${clue.number}. ${clue.clue} (${clue.length})`;
      for (const line of wrapText(label, ctx.font, clueSize, columnWidth)) {
        drawLine(line);
      }
    }
    y -= 8;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = `   ${word}`;
    }
  }
  if (current) {
    lines.push(current);
  }

  return lines;
}
