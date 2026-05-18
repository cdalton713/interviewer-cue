import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createFileAppLogger,
  getAppLogFilePath,
  getInterviewLogFilePath,
} from "../src/logging/app-log.js";

describe("app file logging", () => {
  it("uses a repo-local general log file", () => {
    expect(
      getAppLogFilePath({
        rootDir: "/repo/interviewer-cue",
      }),
    ).toBe("/repo/interviewer-cue/logs/interviewer-cue.log.jsonl");
  });

  it("uses a repo-local log file per interview session", () => {
    expect(
      getInterviewLogFilePath("session:one/with spaces", {
        rootDir: "/repo/interviewer-cue",
      }),
    ).toBe("/repo/interviewer-cue/logs/interviews/session-one-with-spaces.log.jsonl");
  });

  it("appends structured JSONL entries with timestamps", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "interviewer-cue-log-"));
    const filePath = path.join(dir, "nested", "interviewer-cue.log.jsonl");
    const logger = createFileAppLogger({
      filePath,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
    });

    logger.log({
      event: "ai.api_call.started",
      requestId: "live-1",
      provider: "google",
      model: "gemini-2.5-flash",
    });
    logger.log({
      event: "ai.api_call.succeeded",
      requestId: "live-1",
      durationMs: 123,
      questionCount: 3,
    });
    await logger.flush?.();

    const lines = (await fs.readFile(filePath, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      timestamp: "2026-05-18T12:00:00.000Z",
      level: "info",
      event: "ai.api_call.started",
      requestId: "live-1",
      provider: "google",
      model: "gemini-2.5-flash",
    });
    expect(JSON.parse(lines[1] ?? "")).toEqual(
      expect.objectContaining({
        timestamp: "2026-05-18T12:00:00.000Z",
        level: "info",
        event: "ai.api_call.succeeded",
        durationMs: 123,
        questionCount: 3,
      }),
    );
  });

  it("routes entries with a session id to that interview log", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "interviewer-cue-log-"));
    const logger = createFileAppLogger({
      rootDir,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
    });

    logger.log({
      event: "live_generation.started",
      sessionId: "session-1",
      requestId: "live-1",
    });
    logger.log({
      event: "app.started",
    });
    await logger.flush?.();

    const interviewLog = await fs.readFile(
      path.join(rootDir, "logs", "interviews", "session-1.log.jsonl"),
      "utf8",
    );
    const generalLog = await fs.readFile(
      path.join(rootDir, "logs", "interviewer-cue.log.jsonl"),
      "utf8",
    );

    expect(JSON.parse(interviewLog.trim())).toEqual(
      expect.objectContaining({
        event: "live_generation.started",
        sessionId: "session-1",
      }),
    );
    expect(JSON.parse(generalLog.trim())).toEqual(
      expect.objectContaining({
        event: "app.started",
      }),
    );
  });
});
