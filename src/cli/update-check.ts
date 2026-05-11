import { spawn } from "node:child_process";
import process from "node:process";
import readline from "node:readline/promises";

import {
  GITHUB_REPOSITORY,
  PACKAGE_NAME,
} from "./package-info.js";

const NPM_LATEST_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`;

export type UpdateCheckMode = "startup" | "manual";

export type UpdateCheckResult =
  | { status: "skipped" }
  | { status: "up-to-date"; latestVersion: string }
  | {
      status: "declined";
      currentVersion: string;
      latestVersion: string;
    }
  | {
      status: "installed";
      currentVersion: string;
      latestVersion: string;
    }
  | { status: "failed"; error: Error };

export interface UpdateCheckDeps {
  currentVersion: string;
  mode: UpdateCheckMode;
  fetchJson?: (url: string) => Promise<unknown>;
  confirm?: (message: string) => Promise<boolean>;
  install?: (packageSpec: string) => Promise<void>;
  output?: Pick<typeof console, "log" | "error">;
}

export function shouldSkipUpdateCheck(options: {
  argv: string[];
  env: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): boolean {
  return (
    options.argv.includes("--no-update-check") ||
    options.env.INTERVIEWER_CUE_SKIP_UPDATE === "1"
  );
}

export async function runUpdateCheck(
  deps: UpdateCheckDeps,
): Promise<UpdateCheckResult> {
  const output = deps.output ?? console;
  const fetchJson = deps.fetchJson ?? fetchJsonFromUrl;
  const install = deps.install ?? installPackageGlobally;
  const confirm = deps.confirm ?? confirmWithTerminal;

  let latestPackage: { version: string };
  try {
    latestPackage = parseLatestPackage(await fetchJson(NPM_LATEST_URL));
  } catch (error) {
    const normalized = normalizeError(error);
    if (deps.mode === "manual") {
      output.error(`Unable to check npm for ${PACKAGE_NAME}: ${normalized.message}`);
    }
    return { status: "failed", error: normalized };
  }

  if (compareSemver(latestPackage.version, deps.currentVersion) <= 0) {
    if (deps.mode === "manual") {
      output.log(`${PACKAGE_NAME} is already up to date (${deps.currentVersion}).`);
    }
    return { status: "up-to-date", latestVersion: latestPackage.version };
  }

  const releaseNotes = await fetchLatestReleaseNotes(fetchJson);
  const accepted = await confirm(
    buildUpdatePrompt({
      currentVersion: deps.currentVersion,
      latestVersion: latestPackage.version,
      releaseNotes,
    }),
  );

  if (!accepted) {
    return {
      status: "declined",
      currentVersion: deps.currentVersion,
      latestVersion: latestPackage.version,
    };
  }

  await install(`${PACKAGE_NAME}@latest`);
  output.log(
    `${PACKAGE_NAME} updated to ${latestPackage.version}. Restart interviewer-cue to use it.`,
  );
  return {
    status: "installed",
    currentVersion: deps.currentVersion,
    latestVersion: latestPackage.version,
  };
}

export function compareSemver(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchLatestReleaseNotes(
  fetchJson: (url: string) => Promise<unknown>,
): Promise<string | undefined> {
  try {
    const release = parseLatestRelease(await fetchJson(GITHUB_LATEST_RELEASE_URL));
    return [release.name, release.htmlUrl].filter(Boolean).join("\n");
  } catch {
    return undefined;
  }
}

function buildUpdatePrompt(input: {
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
}): string {
  const releaseNotes = input.releaseNotes
    ? `\n\nLatest GitHub release:\n${input.releaseNotes}`
    : "";
  return `${PACKAGE_NAME} ${input.currentVersion} is installed. Version ${input.latestVersion} is available.${releaseNotes}\n\nInstall update now?`;
}

function parseLatestPackage(value: unknown): { version: string } {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    typeof value.version !== "string"
  ) {
    throw new Error("npm registry response did not include a version");
  }
  return { version: value.version };
}

function parseLatestRelease(value: unknown): {
  name?: string;
  htmlUrl?: string;
} {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : undefined,
    htmlUrl: typeof record.html_url === "string" ? record.html_url : undefined,
  };
}

function parseVersionParts(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split(".", 3)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

async function fetchJsonFromUrl(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": `${PACKAGE_NAME}/update-check`,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json() as Promise<unknown>;
}

async function confirmWithTerminal(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

async function installPackageGlobally(packageSpec: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["install", "-g", packageSpec], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm install exited with code ${code ?? "unknown"}`));
    });
  });
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
