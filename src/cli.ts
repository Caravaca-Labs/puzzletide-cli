#!/usr/bin/env node
/**
 * ptide / puzzletide — local-first puzzle generator CLI.
 *
 * Command model (mirrors the Textavia CLI):
 *   ptide <namespace> <operation> [input] [options]   # for humans
 *   ptide run <tool-id> [input] [options] --json      # canonical, for scripts/agents
 *   ptide tools list | search <q> | info <id> | docs <id>
 *   ptide agent manifest
 */

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { CliError } from './core/errors.js';
import {
  buildAgentManifest,
  getTool,
  listTools,
  searchTools,
  type ToolDefinition,
} from './core/registry.js';
import { registerAllTools } from './tools/index.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string; description: string };

registerAllTools();

const program = new Command();

program
  .name('ptide')
  .description(
    `${pkg.description}\n\nPuzzles are generated locally — no account, API key, or network access.` +
      '\nOnline versions and printables: https://puzzletide.com'
  )
  .version(pkg.version)
  .option('--json', 'Output structured JSON (agent-friendly)')
  .showSuggestionAfterError(true);

// ----------------------------------------------------------------------------
// Namespace commands from the registry
// ----------------------------------------------------------------------------

const NAMESPACE_DESCRIPTIONS: Record<string, string> = {
  wordsearch: 'Word search generation',
  crossword: 'Crossword generation',
  sudoku: 'Sudoku generation, solving, and validation',
  words: 'Themed word banks: browse, match patterns, anagrams',
  eval: 'Verifiable puzzle tasks for testing agents',
  play: 'Play puzzles in the terminal',
};

const namespaceCommands = new Map<string, Command>();

function namespaceCommand(namespace: string): Command {
  let command = namespaceCommands.get(namespace);
  if (!command) {
    command = program
      .command(namespace)
      .description(NAMESPACE_DESCRIPTIONS[namespace] ?? `${namespace} tools`);
    namespaceCommands.set(namespace, command);
  }
  return command;
}

function applyToolOptions(command: Command, tool: ToolDefinition): void {
  for (const option of tool.options) {
    command.option(option.flag, option.description, option.default as string | boolean | undefined);
  }
  command.option('--json', 'Output structured JSON (agent-friendly)');
}

async function executeTool(
  tool: ToolDefinition,
  positionals: string[],
  options: Record<string, unknown>
): Promise<void> {
  const wantsJson = options.json === true || program.opts().json === true;

  if (tool.interactive && wantsJson) {
    throw new CliError(`${tool.id} is interactive and does not support --json.`);
  }

  const result = await tool.run({ options, args: positionals });

  if (wantsJson && !tool.interactive) {
    console.log(JSON.stringify(result.data, null, 2));
  } else if (result.text) {
    console.log(result.text);
  }
}

function handleError(error: unknown): void {
  if (error instanceof CliError) {
    console.error(`Error: ${error.message}`);
    if (error.hint) {
      console.error(error.hint);
    }
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    if (process.env.PTIDE_DEBUG) {
      console.error(error.stack);
    }
  } else {
    console.error(`Error: ${String(error)}`);
  }
  process.exitCode = 1;
}

for (const tool of listTools()) {
  const parent = namespaceCommand(tool.namespace);
  const usage = tool.positional ? `${tool.operation} ${tool.positional.name}` : tool.operation;
  const command = parent.command(usage).description(tool.summary);
  applyToolOptions(command, tool);

  command.action(async (...actionArgs) => {
    // commander passes: [...positionals], options, command
    const options = actionArgs[actionArgs.length - 2] as Record<string, unknown>;
    const positionals = actionArgs
      .slice(0, -2)
      .filter((arg): arg is string => typeof arg === 'string');
    try {
      await executeTool(tool, positionals, options);
    } catch (error) {
      handleError(error);
    }
  });
}

// `ptide daily` as a top-level alias for `ptide play daily`.
program
  .command('daily')
  .description("Print today's PuzzleTide daily sudoku")
  .option('--json', 'Output structured JSON (agent-friendly)')
  .action(async (options: Record<string, unknown>) => {
    const tool = getTool('play.daily');
    if (!tool) return;
    try {
      await executeTool(tool, [], options);
    } catch (error) {
      handleError(error);
    }
  });

// ----------------------------------------------------------------------------
// Discovery: tools list / search / info / docs
// ----------------------------------------------------------------------------

const toolsCommand = program.command('tools').description('Discover available tools');

function toolSummaryLine(tool: ToolDefinition): string {
  return `${tool.id.padEnd(30)} ${tool.summary}`;
}

toolsCommand
  .command('list')
  .description('List all tools with canonical ids')
  .option('--json', 'Output structured JSON')
  .action((options: Record<string, unknown>) => {
    const tools = listTools();
    if (options.json === true || program.opts().json === true) {
      console.log(
        JSON.stringify(
          tools.map((t) => ({ id: t.id, command: `ptide ${t.namespace} ${t.operation}`, summary: t.summary })),
          null,
          2
        )
      );
      return;
    }
    console.log(tools.map(toolSummaryLine).join('\n'));
    console.log('\nDetails: ptide tools info <tool-id>   Run by id: ptide run <tool-id> [options]');
  });

toolsCommand
  .command('search <query>')
  .description('Search tools by keyword')
  .option('--json', 'Output structured JSON')
  .action((query: string, options: Record<string, unknown>) => {
    const matches = searchTools(query);
    if (options.json === true || program.opts().json === true) {
      console.log(JSON.stringify(matches.map((t) => ({ id: t.id, summary: t.summary })), null, 2));
      return;
    }
    console.log(matches.length === 0 ? 'No matching tools.' : matches.map(toolSummaryLine).join('\n'));
  });

function printToolDetails(id: string, full: boolean, json: boolean): void {
  const tool = getTool(id);
  if (!tool) {
    console.error(`Error: unknown tool id: ${id}`);
    console.error('List tools with: ptide tools list');
    process.exitCode = 1;
    return;
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          id: tool.id,
          command: `ptide ${tool.namespace} ${tool.operation}`,
          summary: tool.summary,
          description: tool.description,
          positional: tool.positional ?? null,
          options: tool.options,
          examples: tool.examples,
          online: tool.online ?? null,
        },
        null,
        2
      )
    );
    return;
  }

  const lines = [
    tool.id,
    `  ${tool.summary}`,
    '',
    `  Command: ptide ${tool.namespace} ${tool.operation}${tool.positional ? ` ${tool.positional.name}` : ''}`,
  ];
  if (full) {
    lines.push('', `  ${tool.description}`);
  }
  if (tool.options.length > 0) {
    lines.push('', '  Options:');
    for (const option of tool.options) {
      const def = option.default !== undefined ? ` (default: ${option.default})` : '';
      lines.push(`    ${option.flag.padEnd(24)} ${option.description}${def}`);
    }
  }
  if (tool.examples.length > 0) {
    lines.push('', '  Examples:');
    for (const example of tool.examples) {
      lines.push(`    # ${example.title}`, `    ${example.command}`);
    }
  }
  if (tool.online) {
    lines.push('', `  Online version: ${tool.online}`);
  }
  console.log(lines.join('\n'));
}

toolsCommand
  .command('info <toolId>')
  .description('Show a tool: options and examples')
  .option('--json', 'Output structured JSON')
  .action((toolId: string, options: Record<string, unknown>) => {
    printToolDetails(toolId, false, options.json === true || program.opts().json === true);
  });

toolsCommand
  .command('docs <toolId>')
  .description('Show full documentation for a tool')
  .option('--json', 'Output structured JSON')
  .action((toolId: string, options: Record<string, unknown>) => {
    printToolDetails(toolId, true, options.json === true || program.opts().json === true);
  });

// ----------------------------------------------------------------------------
// Canonical runner: ptide run <tool-id> [args/options]
// ----------------------------------------------------------------------------

program
  .command('run <toolId>')
  .description('Run a tool by canonical id (see: ptide tools list)')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .helpOption(false)
  .action(async (toolId: string, _options: Record<string, unknown>, command: Command) => {
    const tool = getTool(toolId);
    if (!tool) {
      console.error(`Error: unknown tool id: ${toolId}`);
      console.error('List tools with: ptide tools list');
      process.exitCode = 1;
      return;
    }
    if (tool.interactive) {
      console.error(`Error: ${tool.id} is interactive; run it as: ptide ${tool.namespace} ${tool.operation}`);
      process.exitCode = 1;
      return;
    }

    // Re-parse everything after the tool id with the tool's own option set.
    const scratch = new Command();
    scratch.exitOverride();
    scratch.helpOption(false);
    scratch.allowExcessArguments(true);
    applyToolOptions(scratch, tool);

    const rest = command.args.slice(1);
    try {
      scratch.parse(rest, { from: 'user' });
      await executeTool(tool, scratch.args, scratch.opts());
    } catch (error) {
      handleError(error);
    }
  });

// ----------------------------------------------------------------------------
// Agent manifest
// ----------------------------------------------------------------------------

program
  .command('agent')
  .description('Agent integration helpers')
  .command('manifest')
  .description('Print a JSON manifest of all tools for agent consumption')
  .action(() => {
    console.log(JSON.stringify(buildAgentManifest(pkg.version), null, 2));
  });

program.parseAsync(process.argv).catch(handleError);
