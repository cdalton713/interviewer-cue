import { describe, expect, it, vi } from "vitest";

import { runInterviewerCue } from "../src/cli/interviewer-cue.js";

describe("runInterviewerCue", () => {
  it("runs the startup update check before launching the app", async () => {
    const runApp = vi.fn();
    const updateCheck = vi.fn().mockResolvedValue({ status: "up-to-date" });

    await runInterviewerCue(["--resume", "/tmp/resume.pdf"], {
      runApp,
      decryptCache: vi.fn(),
      watchCache: vi.fn(),
      simulateTranscript: vi.fn(),
      updateCheck,
      env: {},
      output: silentOutput(),
    });

    expect(updateCheck).toHaveBeenCalledWith({
      currentVersion: "0.1.0",
      mode: "startup",
    });
    expect(runApp).toHaveBeenCalledWith(["--resume", "/tmp/resume.pdf"]);
  });

  it("skips update checks for provider subcommands", async () => {
    const decryptCache = vi.fn();
    const updateCheck = vi.fn();

    await runInterviewerCue(["granola", "decrypt-cache", "--summary"], {
      runApp: vi.fn(),
      decryptCache,
      watchCache: vi.fn(),
      simulateTranscript: vi.fn(),
      updateCheck,
      env: {},
      output: silentOutput(),
    });

    expect(updateCheck).not.toHaveBeenCalled();
    expect(decryptCache).toHaveBeenCalledWith(["--summary"]);
  });

  it("exits before launching the app when a startup update was installed", async () => {
    const runApp = vi.fn();

    await runInterviewerCue([], {
      runApp,
      decryptCache: vi.fn(),
      watchCache: vi.fn(),
      simulateTranscript: vi.fn(),
      updateCheck: vi.fn().mockResolvedValue({ status: "installed" }),
      env: {},
      output: silentOutput(),
    });

    expect(runApp).not.toHaveBeenCalled();
  });
});

function silentOutput() {
  return {
    log: vi.fn(),
    error: vi.fn(),
  };
}
