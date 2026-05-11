import { describe, expect, it, vi } from "vitest";

import { installTerminalLifecycle } from "../src/cli/terminal-lifecycle.js";

describe("installTerminalLifecycle", () => {
  it("enters isolated TUI mode immediately and restores the terminal on shutdown", () => {
    const writeOut = vi.fn();
    const onExit = vi.fn();

    installTerminalLifecycle({ writeOut, onExit });

    expect(writeOut).toHaveBeenCalledWith("\x1b[?1049h\x1b[?7l\x1b[?25l\x1b[2J\x1b[H");
    expect(onExit).toHaveBeenCalledOnce();

    const shutdownHandler = onExit.mock.calls[0]?.[0];
    expect(typeof shutdownHandler).toBe("function");

    shutdownHandler?.();

    expect(writeOut).toHaveBeenLastCalledWith("\x1b[?25h\x1b[?7h\x1b[?1049l");
  });
});
