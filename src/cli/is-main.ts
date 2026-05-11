import path from "node:path";
import { fileURLToPath } from "node:url";

export function isMain(
  importMetaUrl: string,
  argv = process.argv,
  entryName?: string,
): boolean {
  const entrypoint = argv[1];
  if (!entrypoint) return false;
  if (entryName && basenameWithoutExtension(entrypoint) !== entryName) return false;
  return fileURLToPath(importMetaUrl) === path.resolve(entrypoint);
}

function basenameWithoutExtension(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}
