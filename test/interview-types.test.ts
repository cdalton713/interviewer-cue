import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getInterviewTypesFilePath,
  loadInterviewTypes,
  saveInterviewTypes,
  validateInterviewType,
} from "../src/interview/interview-types.js";

describe("interview type persistence", () => {
  it("uses the macOS Application Support location", () => {
    expect(
      getInterviewTypesFilePath({
        platform: "darwin",
        homeDir: "/Users/tester",
        env: {},
      }),
    ).toBe(
      "/Users/tester/Library/Application Support/interviewer-cue/interview-types.json",
    );
  });

  it("uses XDG config on non-macOS platforms", () => {
    expect(
      getInterviewTypesFilePath({
        platform: "linux",
        homeDir: "/home/tester",
        env: { XDG_CONFIG_HOME: "/tmp/config" },
      }),
    ).toBe("/tmp/config/interviewer-cue/interview-types.json");
  });

  it("round-trips valid interview types through JSON", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "interviewer-cue-"));
    const filePath = path.join(dir, "nested", "interview-types.json");
    const type = validateInterviewType({
      id: "technical",
      name: "Technical Interview",
      systemPrompt: "Assess engineering judgement.",
      qualities: ["architecture", "debugging"],
      questionTypes: ["behavioral", "systems"],
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:00:00.000Z",
    });

    await saveInterviewTypes([type], filePath);

    await expect(loadInterviewTypes(filePath)).resolves.toEqual([type]);
  });

  it("rejects persisted types missing structured fields", () => {
    expect(() =>
      validateInterviewType({
        id: "technical",
        name: "Technical Interview",
        systemPrompt: "Assess engineering judgement.",
        qualities: "debugging",
        questionTypes: [],
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      }),
    ).toThrow("Invalid interview type");
  });
});
