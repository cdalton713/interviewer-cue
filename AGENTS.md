# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

Interviewer Cue is a Node 20+ TypeScript terminal app for live interviews. It uses Ink/React for the terminal UI, reads transcript updates from Granola or a local simulation source, and generates interview follow-up questions through AI SDK providers.

Primary entry points:

- `src/cli/interviewer-cue.ts` is the published CLI dispatcher.
- `src/app.tsx` launches the Ink app.
- `src/ui/ChatApp.tsx` owns the main terminal UI flow.
- `src/granola/` contains Granola cache reading, crypto, and watch logic.
- `src/interview/` contains interview type/session data and prompts.
- `src/ai/` contains provider registration and question generation.
- `src/simulation/` contains the transcript simulation protocol and server/client pieces.
- `test/` contains Vitest and Ink component tests.

## Commands

Use pnpm. The project expects Node.js 20 or newer.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm pack:dry-run
```

Useful development commands:

```bash
pnpm dev
pnpm dev:simulation
pnpm simulate
pnpm cli:decrypt
pnpm cli:watch
```

Run focused tests with Vitest when working on a narrow area, for example:

```bash
pnpm vitest test/chat-app.test.tsx
pnpm vitest test/update-check.test.ts
```

Before release-oriented changes, run the release checklist from `README.md`: install with the frozen lockfile, test, typecheck, build, and dry-run the npm package.

## Coding Conventions

- Keep TypeScript strict. The repo uses `noUncheckedIndexedAccess`, `isolatedModules`, `moduleResolution: "NodeNext"`, and ESM.
- Use explicit `.js` extensions in relative TypeScript imports that compile to runtime ESM imports.
- Prefer dependency injection for filesystem, process, network, timer, and terminal side effects so behavior stays testable.
- Keep CLI parsing and help text in the relevant `src/cli/*-args.ts` module, with tests in `test/`.
- Keep user-facing persistent data shapes in `src/config/` or `src/interview/` and update corresponding tests when schemas or defaults change.
- Avoid broad refactors while changing CLI, Granola cache, prompt, or UI behavior. These paths are user-facing and are covered by focused tests.
- Do not commit generated `dist/` output unless a release task explicitly asks for it.

## Testing Notes

- Tests run in the Node Vitest environment.
- Ink UI tests use `ink-testing-library`; prefer assertions on stripped or stable frame text instead of timing-sensitive snapshots.
- Use fake event sources and injected dependencies for UI and CLI tests rather than touching real Granola cache files, real keychain data, or network services.
- Add or update focused tests for changed behavior. Common mappings:
  - CLI dispatch and help: `test/interviewer-cue-*.test.ts`, `test/*-args.test.ts`
  - UI flow: `test/chat-app.test.tsx`
  - Granola cache/watch behavior: `test/*granola*.test.ts`, `test/watch-cache.test.ts`
  - Interview data and prompts: `test/interview-*.test.ts`, `test/*prompt*.test.ts`
  - AI question generation: `test/question-generation.test.ts`

## Operational Boundaries

- Treat Granola cache and keychain access as local, sensitive integrations. Do not read or dump a user's real cache/keychain data unless the task explicitly requires it.
- Do not add live network calls to tests. Mock registry, provider, and update-check behavior.
- Preserve existing uncommitted user changes. This repository may have a dirty worktree; inspect before editing and keep patches scoped.
- When modifying package metadata, build config, or CLI entry points, verify the published package shape with `pnpm build` and `pnpm pack:dry-run` when practical.
