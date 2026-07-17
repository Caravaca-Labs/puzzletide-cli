#!/usr/bin/env node
/**
 * puzzletide-mcp — MCP server exposing the PuzzleTide puzzle tools.
 *
 * Every non-interactive tool from the puzzletide registry (word search,
 * crossword, and sudoku generation, sudoku solving/validation, word tools,
 * and verifiable evals) is exposed as an MCP tool. Tool names are the
 * canonical registry ids with dots replaced by underscores, e.g.
 * puzzle.sudoku.generate -> puzzle_sudoku_generate.
 */

import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z, type ZodTypeAny } from 'zod';
import {
  CliError,
  listTools,
  registerAllTools,
  type ToolDefinition,
  type ToolOption,
} from 'puzzletide';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

interface ParsedOption {
  key: string;
  takesValue: boolean;
  negated: boolean;
}

/** Parses a commander-style flag ("--min-length <n>") into a schema key. */
function parseFlag(flag: string): ParsedOption | null {
  const match = flag.match(/^--(no-)?([a-z][a-z0-9-]*)(\s+<.+>)?$/i);
  if (!match) return null;
  const negated = Boolean(match[1]);
  const key = match[2].replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return { key, takesValue: Boolean(match[3]), negated };
}

function optionToSchema(option: ToolOption): { key: string; schema: ZodTypeAny } | null {
  const parsed = parseFlag(option.flag);
  if (!parsed) return null;

  let description = option.description;
  if (option.default !== undefined) {
    description += ` (default: ${option.default})`;
  }

  if (parsed.negated) {
    return {
      key: parsed.key,
      schema: z.boolean().optional().describe(`${description} — set false to disable`),
    };
  }
  if (!parsed.takesValue) {
    return { key: parsed.key, schema: z.boolean().optional().describe(description) };
  }
  return {
    key: parsed.key,
    schema: z.union([z.string(), z.number()]).optional().describe(description),
  };
}

function buildInputSchema(tool: ToolDefinition): Record<string, ZodTypeAny> {
  const shape: Record<string, ZodTypeAny> = {};

  if (tool.positional) {
    const key = tool.positional.name.replace(/[[\]<>]/g, '');
    const base = z.string().describe(tool.positional.description);
    shape[key] = tool.positional.required ? base : base.optional();
  }

  for (const option of tool.options) {
    const entry = optionToSchema(option);
    if (entry) {
      shape[entry.key] = entry.schema;
    }
  }

  return shape;
}

async function main(): Promise<void> {
  registerAllTools();

  const server = new McpServer(
    { name: 'puzzletide', version: pkg.version },
    {
      instructions:
        'Local-first puzzle tools: word search generator, crossword generator, sudoku ' +
        'generator/solver/validator, themed word banks, and verifiable puzzle evals for ' +
        'benchmarking. Puzzles are deterministic for a given seed. Never hand-write puzzle ' +
        'grids — these tools guarantee correctness. File-producing arguments (pdf, svg, out) ' +
        'take file paths and write printable worksheets. Online versions: https://puzzletide.com',
    }
  );

  for (const tool of listTools()) {
    if (tool.interactive) continue;

    const positionalKey = tool.positional?.name.replace(/[[\]<>]/g, '');

    server.registerTool(
      tool.id.replace(/\./g, '_'),
      {
        title: `${tool.namespace} ${tool.operation}`,
        description:
          tool.description + (tool.online ? ` Online version: ${tool.online}` : ''),
        inputSchema: buildInputSchema(tool),
      },
      async (input: Record<string, unknown>) => {
        const options: Record<string, unknown> = { ...input };
        const args: string[] = [];

        if (positionalKey && input[positionalKey] !== undefined) {
          args.push(String(input[positionalKey]));
          delete options[positionalKey];
        }

        try {
          const result = await tool.run({ options, args });
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result.data, null, 2),
              },
            ],
          };
        } catch (error) {
          const message =
            error instanceof CliError
              ? `${error.message}${error.hint ? `\n${error.hint}` : ''}`
              : error instanceof Error
                ? error.message
                : String(error);
          return {
            content: [{ type: 'text' as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }

  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
