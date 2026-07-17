// Builds the Smithery/desktop MCPB bundle (server.mcpb) for puzzletide-mcp.
//
// The bundle wraps the PUBLISHED npm package (with its node_modules), so
// publish puzzletide-mcp to npm first, then run:
//
//   npm i -g @anthropic-ai/mcpb   # once
//   node scripts/build-mcpb.mjs   # from the mcp/ directory
//
// Output: dist-mcpb/server.mcpb — upload via smithery.ai/new (Local tab)
// or: smithery mcp publish ./dist-mcpb/server.mcpb -n caravaca-labs/puzzletide

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mcpPkg = JSON.parse(fs.readFileSync(path.join(here, '../package.json'), 'utf8'));
const version = mcpPkg.version;

const staging = path.join(here, '../dist-mcpb/staging');
const output = path.join(here, '../dist-mcpb/server.mcpb');
fs.rmSync(path.dirname(staging), { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

fs.writeFileSync(
  path.join(staging, 'package.json'),
  JSON.stringify(
    {
      name: 'puzzletide-mcpb-staging',
      private: true,
      dependencies: { 'puzzletide-mcp': version },
    },
    null,
    2
  )
);

const manifest = {
  manifest_version: '0.2',
  name: 'puzzletide',
  display_name: 'PuzzleTide',
  version,
  description:
    'Word search, crossword, and sudoku generators, printable PDF worksheets, and verifiable LLM evals.',
  long_description:
    'Local-first puzzle generation: word search generator, crossword generator, and sudoku ' +
    'generator + solver with a unique-solution guarantee. Printable PDF worksheets (puzzle + ' +
    'solution pages), themed word banks, and reproducible, objectively gradable puzzle evals ' +
    'for benchmarking models. Everything runs locally — no account, API key, or network ' +
    'access. From the makers of https://puzzletide.com',
  author: { name: 'Caravaca Labs', url: 'https://puzzletide.com' },
  homepage: 'https://puzzletide.com',
  documentation: 'https://github.com/Caravaca-Labs/puzzletide-cli/blob/main/docs/mcp.md',
  repository: { type: 'git', url: 'https://github.com/Caravaca-Labs/puzzletide-cli' },
  license: 'MIT',
  keywords: [
    'puzzle-generator',
    'word-search-generator',
    'crossword-generator',
    'sudoku-generator',
    'sudoku-solver',
    'printable-puzzles',
    'llm-evals',
  ],
  server: {
    type: 'node',
    entry_point: 'node_modules/puzzletide-mcp/dist/server.js',
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/node_modules/puzzletide-mcp/dist/server.js'],
    },
  },
  compatibility: {
    platforms: ['darwin', 'win32', 'linux'],
    runtimes: { node: '>=18.17' },
  },
};

fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));

execSync('npm install --omit=dev --no-fund --no-audit', { cwd: staging, stdio: 'inherit' });
execSync('mcpb validate manifest.json', { cwd: staging, stdio: 'inherit' });
execSync(`mcpb pack . ${JSON.stringify(output)}`, { cwd: staging, stdio: 'inherit' });

console.log(`\nBuilt ${output} (puzzletide-mcp@${version})`);
