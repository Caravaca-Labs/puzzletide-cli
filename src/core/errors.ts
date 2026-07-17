/** Error for expected failures: printed as a clean message, exit code 1. */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = 'CliError';
  }
}
