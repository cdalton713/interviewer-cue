import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function chooseResumeFile(): Promise<string> {
  if (process.platform !== "darwin") {
    throw new Error("Resume file picker is only supported on macOS");
  }

  const script = [
    'set pickedFile to choose file with prompt "Choose a resume PDF" of type {"pdf"}',
    "POSIX path of pickedFile",
  ].join("\n");
  const result = await execFileAsync("osascript", ["-e", script]);
  return result.stdout.trim();
}

export function isResumePickerCancelError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("User canceled") || message.includes("(-128)");
}
