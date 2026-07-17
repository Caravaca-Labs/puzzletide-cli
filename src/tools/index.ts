/** Registers every tool with the registry. */

import { registerTool } from '../core/registry.js';
import { generateTools } from './generate.js';
import { wordsTools } from './words.js';
import { evalTools } from './evals.js';
import { playTools } from './play.js';

let registered = false;

export function registerAllTools(): void {
  if (registered) return;
  registered = true;

  for (const tool of [...generateTools, ...wordsTools, ...evalTools, ...playTools]) {
    registerTool(tool);
  }
}
