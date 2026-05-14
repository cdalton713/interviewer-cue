#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const VALID_BUMPS = new Set(["patch", "minor", "major"]);
const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

export function parseReleaseArgs(argv) {
  const options = {
    bump: "patch",
    dryRun: false,
    otp: undefined,
    publish: false,
    push: false,
    skipVerify: false,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--publish") {
      options.publish = true;
      continue;
    }
    if (arg === "--push") {
      options.push = true;
      continue;
    }
    if (arg === "--skip-verify") {
      options.skipVerify = true;
      continue;
    }
    if (arg === "--otp") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --otp");
      }
      options.otp = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--otp=")) {
      const value = arg.slice("--otp=".length);
      if (!value) {
        throw new Error("Missing value for --otp");
      }
      options.otp = value;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1) {
    throw new Error("Only one release bump/version may be provided");
  }

  if (positional[0]) {
    if (!VALID_BUMPS.has(positional[0]) && !EXACT_VERSION_PATTERN.test(positional[0])) {
      throw new Error("Release must be patch, minor, major, or an exact x.y.z version");
    }
    options.bump = positional[0];
  }

  return options;
}

export function buildReleasePlan(options) {
  const steps = [
    { label: "Check clean working tree" },
    { label: "Bump package version", command: ["pnpm", "version", options.bump, "--no-git-tag-version"] },
    { label: "Refresh lockfile", command: ["pnpm", "install", "--lockfile-only"] },
  ];

  if (!options.skipVerify) {
    steps.push(
      { label: "Run tests", command: ["pnpm", "test"] },
      { label: "Typecheck", command: ["pnpm", "typecheck"] },
      { label: "Build", command: ["pnpm", "build"] },
      { label: "Verify package contents", command: ["pnpm", "pack:dry-run"] },
    );
  }

  steps.push(
    { label: "Stage release files", command: ["git", "add", "package.json", "pnpm-lock.yaml"] },
    { label: "Commit release" },
    { label: "Create annotated tag" },
  );

  if (options.publish) {
    const publishCommand = options.otp ? ["npm", "publish", "--otp", options.otp] : ["npm", "publish"];
    steps.push({ label: "Publish to npm", command: publishCommand });
  }

  if (options.push) {
    steps.push({ label: "Push branch" }, { label: "Push tag" });
  }

  if (options.dryRun) {
    return steps.map((step) => ({ ...step, dryRunOnly: true }));
  }

  return steps;
}

function runRelease(options) {
  const plan = buildReleasePlan(options);

  if (options.dryRun) {
    console.log("Release plan:");
    for (const step of plan) {
      const command = step.command ? `: ${step.command.join(" ")}` : "";
      console.log(`- ${step.label}${command}`);
    }
    return;
  }

  ensureCleanWorkingTree();
  run("Bump package version", "pnpm", ["version", options.bump, "--no-git-tag-version"]);
  run("Refresh lockfile", "pnpm", ["install", "--lockfile-only"]);

  if (!options.skipVerify) {
    run("Run tests", "pnpm", ["test"]);
    run("Typecheck", "pnpm", ["typecheck"]);
    run("Build", "pnpm", ["build"]);
    run("Verify package contents", "pnpm", ["pack:dry-run"]);
  }

  const version = readPackageVersion();
  const tag = `v${version}`;

  run("Stage release files", "git", ["add", "package.json", "pnpm-lock.yaml"]);
  run("Commit release", "git", ["commit", "-m", `chore: release ${tag}`]);
  run("Create annotated tag", "git", ["tag", "-a", tag, "-m", tag]);

  if (options.publish) {
    run("Publish to npm", "npm", options.otp ? ["publish", "--otp", options.otp] : ["publish"]);
  }

  if (options.push) {
    run("Push branch", "git", ["push", "origin", "HEAD"]);
    run("Push tag", "git", ["push", "origin", tag]);
    const publishMessage = options.publish ? "published to npm" : "created locally";
    console.log(`${tag} ${publishMessage} and pushed to GitHub.`);
  } else {
    const publishMessage = options.publish ? "published to npm" : "created locally";
    console.log(`${tag} ${publishMessage}. Push with: git push origin HEAD && git push origin ${tag}`);
  }
}

function ensureCleanWorkingTree() {
  const status = spawnSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

  if (status.status !== 0) {
    throw new Error("Unable to check git status");
  }

  if (status.stdout.trim()) {
    throw new Error("Working tree must be clean before cutting a release");
  }
}

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (typeof pkg.version !== "string") {
    throw new Error("package.json version is missing");
  }
  return pkg.version;
}

function run(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

function main() {
  try {
    runRelease(parseReleaseArgs(process.argv.slice(2)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`release failed: ${message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
