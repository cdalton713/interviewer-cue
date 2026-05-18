import fs from "node:fs/promises";
import path from "node:path";

export type AppLogLevel = "debug" | "info" | "warn" | "error";

export type AppLogEntry = {
  event: string;
  level?: AppLogLevel;
  [key: string]: unknown;
};

export interface AppLogger {
  log(entry: AppLogEntry): void;
  flush?: () => Promise<void>;
}

export interface AppLogPathOptions {
  rootDir?: string;
}

export interface FileAppLoggerOptions extends AppLogPathOptions {
  filePath?: string;
  now?: () => Date;
}

export function getAppLogFilePath(options: AppLogPathOptions = {}): string {
  return path.join(getLogRootDir(options), "logs", "interviewer-cue.log.jsonl");
}

export function getInterviewLogFilePath(
  sessionId: string,
  options: AppLogPathOptions = {},
): string {
  return path.join(
    getLogRootDir(options),
    "logs",
    "interviews",
    `${sanitizeLogFileName(sessionId)}.log.jsonl`,
  );
}

export function createNoopAppLogger(): AppLogger {
  return {
    log() {},
    async flush() {},
  };
}

export function createFileAppLogger(options: FileAppLoggerOptions = {}): AppLogger {
  const now = options.now ?? (() => new Date());
  let pendingWrite = Promise.resolve();

  async function appendEntry(entry: AppLogEntry) {
    const filePath = getTargetLogFilePath(entry, options);
    const serialized = `${JSON.stringify({
      timestamp: now().toISOString(),
      level: entry.level ?? "info",
      ...entry,
    })}\n`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, serialized, "utf8");
  }

  return {
    log(entry) {
      pendingWrite = pendingWrite
        .catch(() => undefined)
        .then(() => appendEntry(entry))
        .catch(() => undefined);
    },
    async flush() {
      await pendingWrite;
    },
  };
}

function getTargetLogFilePath(
  entry: AppLogEntry,
  options: FileAppLoggerOptions,
): string {
  if (options.filePath) return options.filePath;
  return typeof entry.sessionId === "string" && entry.sessionId.trim()
    ? getInterviewLogFilePath(entry.sessionId, options)
    : getAppLogFilePath(options);
}

function getLogRootDir(options: AppLogPathOptions): string {
  return options.rootDir ?? process.cwd();
}

function sanitizeLogFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "unknown-session";
}
