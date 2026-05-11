import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInterviewSessionsFilePath,
  loadInterviewSessions,
  saveInterviewSessions,
  validateInterviewSession,
} from "../src/interview/interview-sessions.js";

describe("interview session persistence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the same app support directory as interview types", () => {
    expect(
      getInterviewSessionsFilePath({
        platform: "darwin",
        homeDir: "/Users/tester",
        env: {},
      }),
    ).toBe(
      "/Users/tester/Library/Application Support/interviewer-cue/interview-sessions.json",
    );
  });

  it("uses XDG config on non-macOS platforms", () => {
    expect(
      getInterviewSessionsFilePath({
        platform: "linux",
        homeDir: "/home/tester",
        env: { XDG_CONFIG_HOME: "/tmp/config" },
      }),
    ).toBe("/tmp/config/interviewer-cue/interview-sessions.json");
  });

  it("round-trips valid interview sessions through JSON", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "interviewer-cue-"));
    const filePath = path.join(dir, "nested", "interview-sessions.json");
    const session = validateInterviewSession({
      id: "session-1",
      status: "active",
      candidateName: "Ada Lovelace",
      templateId: "technical",
      templateSnapshot: technicalTemplate,
      resumePath: "/tmp/resume.pdf",
      transcriptEvents: [
        {
          type: "transcript",
          id: "docA:utt1",
          documentId: "docA",
          utteranceId: "utt1",
          text: "We shipped the queue.",
          observedAt: "2026-05-11T00:01:00.000Z",
          isFinal: true,
        },
      ],
      generalQuestions: [{ question: "Why a queue?" }],
      liveQuestions: [{ question: "What changed operationally?" }],
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:02:00.000Z",
    });

    await saveInterviewSessions([session], filePath);

    await expect(loadInterviewSessions(filePath)).resolves.toEqual([session]);
  });

  it("serializes concurrent saves to the same sessions file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "interviewer-cue-"));
    const filePath = path.join(dir, "nested", "interview-sessions.json");
    const firstWrite = deferred<void>();
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);
    const writeFile = vi
      .spyOn(fs, "writeFile")
      .mockImplementation(async (_filePath, _data, _encoding) => {
        if (writeFile.mock.calls.length === 1) {
          await firstWrite.promise;
        }
      });

    const firstSave = saveInterviewSessions(
      [
        validateInterviewSession({
          id: "session-1",
          status: "active",
          templateId: "technical",
          templateSnapshot: technicalTemplate,
          transcriptEvents: [],
          generalQuestions: [],
          liveQuestions: [],
          createdAt: "2026-05-11T00:00:00.000Z",
          updatedAt: "2026-05-11T00:00:00.000Z",
        }),
      ],
      filePath,
    );
    await waitFor(() => writeFile.mock.calls.length === 1);

    const secondSave = saveInterviewSessions(
      [
        validateInterviewSession({
          id: "session-2",
          status: "active",
          templateId: "technical",
          templateSnapshot: technicalTemplate,
          transcriptEvents: [
            {
              type: "transcript",
              id: "docA:utt1",
              documentId: "docA",
              utteranceId: "utt1",
              text: "A later save with more data must not overlap the first write.",
              observedAt: "2026-05-11T00:01:00.000Z",
              isFinal: true,
            },
          ],
          generalQuestions: [],
          liveQuestions: [],
          createdAt: "2026-05-11T00:00:00.000Z",
          updatedAt: "2026-05-11T00:02:00.000Z",
        }),
      ],
      filePath,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(writeFile).toHaveBeenCalledTimes(1);

    firstWrite.resolve();
    await Promise.all([firstSave, secondSave]);

    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  it("rejects sessions with invalid status values", () => {
    expect(() =>
      validateInterviewSession({
        id: "session-1",
        status: "paused",
        templateId: "technical",
        templateSnapshot: technicalTemplate,
        transcriptEvents: [],
        generalQuestions: [],
        liveQuestions: [],
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      }),
    ).toThrow("Invalid interview session");
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

async function waitFor(assertion: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for assertion");
}

const technicalTemplate = {
  id: "technical",
  name: "Technical Interview",
  systemPrompt: "Assess technical depth.",
  qualities: ["debugging", "architecture"],
  questionTypes: ["systems", "behavioral"],
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:00:00.000Z",
};
