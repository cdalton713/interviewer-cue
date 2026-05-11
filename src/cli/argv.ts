export function normalizeScriptArgv(argv: string[]): string[] {
  return argv[0] === "--" ? argv.slice(1) : argv;
}
