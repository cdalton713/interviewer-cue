# Interviewer Cue

Interviewer Cue is a terminal assistant for live interviews. It watches a transcript source, keeps an interview session in local config, and helps generate targeted follow-up questions while the interview is running.

## Install

```bash
npm install -g interviewer-cue
interviewer-cue
```

Requirements:

- Node.js 20 or newer
- Granola installed and signed in when using the Granola transcript source
- API keys configured in the app for the model providers you use

## Commands

```bash
interviewer-cue
interviewer-cue --no-update-check
interviewer-cue update
interviewer-cue granola decrypt-cache
interviewer-cue granola watch-cache
interviewer-cue simulate-transcript
```

`interviewer-cue` launches the Ink app. Granola-specific cache tools live under the `granola` provider namespace because they inspect or watch Granola local cache files directly.

## Updates

On launch, Interviewer Cue checks `https://registry.npmjs.org/interviewer-cue/latest` before entering the full-screen terminal UI. If a newer npm version is available, it prompts before running:

```bash
npm install -g interviewer-cue@latest
```

After a successful update, restart `interviewer-cue`.

Skip the launch-time check with either escape hatch:

```bash
interviewer-cue --no-update-check
INTERVIEWER_CUE_SKIP_UPDATE=1 interviewer-cue
```

Run a manual check any time:

```bash
interviewer-cue update
```

## Granola Setup

The default Granola cache directory is:

```text
~/Library/Application Support/Granola
```

Use the cache commands when troubleshooting transcript access:

```bash
interviewer-cue granola decrypt-cache --summary
interviewer-cue granola decrypt-cache --json
interviewer-cue granola decrypt-cache --transcript <documentId>
interviewer-cue granola watch-cache --changes-only
```

Both commands accept:

```bash
--granola-dir <path>
--keychain-service <name>
--keychain-account <name>
```

## Config Paths

Interviewer Cue stores user-facing settings under `interviewer-cue`.

macOS:

```text
~/Library/Application Support/interviewer-cue/app-settings.json
~/Library/Application Support/interviewer-cue/interview-types.json
~/Library/Application Support/interviewer-cue/interview-sessions.json
```

Linux and other non-macOS platforms:

```text
$XDG_CONFIG_HOME/interviewer-cue/app-settings.json
$XDG_CONFIG_HOME/interviewer-cue/interview-types.json
$XDG_CONFIG_HOME/interviewer-cue/interview-sessions.json
```

If `XDG_CONFIG_HOME` is not set, Interviewer Cue uses `~/.config/interviewer-cue`.

## Troubleshooting

- If launch hangs before the UI appears, run with `--no-update-check` and try `interviewer-cue update` separately.
- If Granola transcripts are missing, run `interviewer-cue granola decrypt-cache --summary` to confirm the local cache can be read.
- If model calls fail, open the app settings and confirm the relevant provider API key is configured.

## Release Checklist

The release script publishes to npm from the local machine. It bumps `package.json`, refreshes the lockfile, runs the release checks, commits the version bump, creates an annotated `vX.Y.Z` tag, and runs `npm publish`.

One-time setup:

1. Confirm the local npm account has publish access to `interviewer-cue`.
2. Run `npm login` if the local machine is not already authenticated.

Preview the release plan:

```bash
pnpm release:dry-run
```

Cut and deploy a patch release:

```bash
pnpm release:patch
```

Use `pnpm release:minor` or `pnpm release:major` for larger bumps. For an exact version, run:

```bash
pnpm release -- 1.2.3
```

To push the release commit and tag after publishing, pass `--push`:

```bash
pnpm release:patch -- --push
```

Before publishing to npm, the script runs:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm pack:dry-run
```

The dry-run pack output should include `dist`, `fixtures/simulation/technical-interview.md`, `README.md`, `LICENSE`, and `package.json`.
