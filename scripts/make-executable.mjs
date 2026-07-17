// Marks the compiled CLI entry as executable after tsc build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/cli.js'
);
if (fs.existsSync(cli)) {
  fs.chmodSync(cli, 0o755);
}
