export type TerminalLifecycleOptions = {
  writeOut?: (data: string) => void;
  onExit?: (handler: () => void) => void;
};

export const ENTER_TUI_MODE = "\x1b[?1049h\x1b[?7l\x1b[?25l\x1b[2J\x1b[H";
export const EXIT_TUI_MODE = "\x1b[?25h\x1b[?7h\x1b[?1049l";

export function installTerminalLifecycle({
  writeOut = (data) => {
    process.stdout.write(data);
  },
  onExit = (handler) => {
    process.once("exit", handler);
  },
}: TerminalLifecycleOptions = {}) {
  writeOut(ENTER_TUI_MODE);
  onExit(() => {
    writeOut(EXIT_TUI_MODE);
  });
}
