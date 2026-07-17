/**
 * Tool registry: every CLI operation is a registered tool with a canonical
 * id (e.g. "puzzle.wordsearch.generate") so agents can discover and run
 * tools by id, mirroring the Textavia CLI command model.
 */

export type ToolCategory = 'puzzle' | 'words' | 'eval' | 'play';

export interface ToolOption {
  /** commander-style flag, e.g. "--size <n>" */
  flag: string;
  description: string;
  default?: string | boolean | number;
}

export interface ToolExample {
  title: string;
  command: string;
}

export interface ToolResult {
  /** Structured payload printed with --json. */
  data: unknown;
  /** Human-readable terminal output. */
  text: string;
}

export interface ToolContext {
  /** Raw option values parsed by commander. */
  options: Record<string, unknown>;
  /** Positional arguments, if the tool takes any. */
  args: string[];
}

export interface ToolDefinition {
  /** Canonical id, e.g. "puzzle.wordsearch.generate". */
  id: string;
  /** CLI namespace, e.g. "wordsearch". */
  namespace: string;
  /** CLI operation, e.g. "generate". */
  operation: string;
  category: ToolCategory;
  summary: string;
  description: string;
  /** Positional argument spec, e.g. "[letters]". */
  positional?: { name: string; description: string; required?: boolean };
  options: ToolOption[];
  examples: ToolExample[];
  /** Matching online tool on puzzletide.com, if any. */
  online?: string;
  /** Interactive tools (play) can't run under `ptide run` / --json. */
  interactive?: boolean;
  run: (ctx: ToolContext) => ToolResult | Promise<ToolResult>;
}

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (tools.has(tool.id)) {
    throw new Error(`Duplicate tool id: ${tool.id}`);
  }
  tools.set(tool.id, tool);
}

export function getTool(id: string): ToolDefinition | undefined {
  return tools.get(id);
}

export function listTools(): ToolDefinition[] {
  return [...tools.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function searchTools(query: string): ToolDefinition[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return listTools().filter((tool) => {
    const haystack = `${tool.id} ${tool.namespace} ${tool.operation} ${tool.summary} ${tool.description}`.toLowerCase();
    return normalized.split(/\s+/).every((term) => haystack.includes(term));
  });
}

/** Manifest for agents: `ptide agent manifest` emits this as JSON. */
export function buildAgentManifest(version: string): unknown {
  return {
    name: 'puzzletide',
    version,
    description:
      'Local-first puzzle generator CLI: word search, crossword, and sudoku generation, solving, validation, printables, and verifiable evals.',
    homepage: 'https://github.com/Caravaca-Labs/puzzletide-cli',
    online: 'https://puzzletide.com',
    usage: {
      human: 'ptide <namespace> <operation> [options]',
      canonical: 'ptide run <tool-id> [options] --json',
      discovery: 'ptide tools list | search <query> | info <tool-id>',
    },
    tools: listTools()
      .filter((tool) => !tool.interactive)
      .map((tool) => ({
        id: tool.id,
        command: `ptide ${tool.namespace} ${tool.operation}`,
        summary: tool.summary,
        options: tool.options.map((o) => ({
          flag: o.flag,
          description: o.description,
          ...(o.default !== undefined ? { default: o.default } : {}),
        })),
        ...(tool.online ? { online: tool.online } : {}),
      })),
  };
}
