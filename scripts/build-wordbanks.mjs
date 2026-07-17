// Compiles the starter word banks (scripts/wordbanks-source.json) into the
// runtime asset the CLI loads (data/wordbanks.json).
//
// The starter themes are generic, original word lists written for this
// package. The full curated PuzzleTide collection is not part of this
// repository — browse it at https://puzzletide.com.
//
// To add a theme: edit scripts/wordbanks-source.json (id "category/slug",
// title, difficulty, description, words[]) and run: npm run build:wordbanks

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceFile = path.join(here, 'wordbanks-source.json');
const outFile = path.resolve(here, '../data/wordbanks.json');

const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

const categoryTitles = new Map(source.categories.map((c) => [c.slug, c.title]));
const counts = new Map();
const themes = [];

for (const theme of source.themes) {
  const [category, slug] = theme.id.split('/');
  if (!category || !slug) {
    throw new Error(`Theme id must be "category/slug": ${theme.id}`);
  }
  if (!categoryTitles.has(category)) {
    throw new Error(`Theme ${theme.id} uses undeclared category "${category}"`);
  }
  const words = (theme.words ?? []).map((w) => String(w).trim()).filter((w) => w.length > 0);
  if (words.length < 8) {
    throw new Error(`Theme ${theme.id} needs at least 8 words (has ${words.length})`);
  }
  if (new Set(words.map((w) => w.toUpperCase())).size !== words.length) {
    throw new Error(`Theme ${theme.id} has duplicate words`);
  }

  themes.push({
    id: theme.id,
    category,
    title: theme.title,
    difficulty: theme.difficulty ?? 'medium',
    description: theme.description ?? '',
    words,
  });
  counts.set(category, (counts.get(category) ?? 0) + 1);
}

const categories = source.categories
  .filter((c) => counts.has(c.slug))
  .map((c) => ({ slug: c.slug, title: c.title, themes: counts.get(c.slug) }));

const payload = {
  source: 'puzzletide-cli starter word banks',
  categories,
  themes,
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(payload));

const totalWords = themes.reduce((n, t) => n + t.words.length, 0);
const unique = new Set(themes.flatMap((t) => t.words.map((w) => w.toUpperCase()))).size;
console.log(
  `Wrote ${outFile}: ${categories.length} categories, ${themes.length} themes, ` +
    `${totalWords} words (${unique} unique)`
);
