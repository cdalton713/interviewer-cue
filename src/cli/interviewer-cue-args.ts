import { Command, CommanderError } from "commander";

export type InterviewerCueCommand =
  | "app"
  | "granolaDecryptCache"
  | "granolaWatchCache"
  | "simulate-transcript"
  | "update";

export interface InterviewerCueArgs {
  command: InterviewerCueCommand;
  args: string[];
  noUpdateCheck: boolean;
  help: boolean;
}

export function parseInterviewerCueArgs(argv: string[]): InterviewerCueArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    const helpIndex = argv.findIndex((arg) => arg === "--help" || arg === "-h");
    if (helpIndex === 0) {
      return {
        command: "app",
        args: [],
        noUpdateCheck: false,
        help: true,
      };
    }
  }

  const noUpdateCheck = argv.includes("--no-update-check");
  const args = argv.filter((arg) => arg !== "--no-update-check");
  const [command, subcommand, ...rest] = args;

  if (command === "granola") {
    if (subcommand === "decrypt-cache") {
      return {
        command: "granolaDecryptCache",
        args: rest,
        noUpdateCheck,
        help: false,
      };
    }
    if (subcommand === "watch-cache") {
      return {
        command: "granolaWatchCache",
        args: rest,
        noUpdateCheck,
        help: false,
      };
    }
    throw new Error(
      `Unknown Granola command: ${subcommand ?? "(missing)"}. Run interviewer-cue --help.`,
    );
  }

  if (command === "simulate-transcript") {
    return {
      command: "simulate-transcript",
      args: args.slice(1),
      noUpdateCheck,
      help: false,
    };
  }

  if (command === "update") {
    return {
      command: "update",
      args: args.slice(1),
      noUpdateCheck,
      help: false,
    };
  }

  return {
    command: "app",
    args,
    noUpdateCheck,
    help: false,
  };
}

export function getInterviewerCueHelp(): string {
  return `${createInterviewerCueCommand().helpInformation()}
Commands:
  interviewer-cue                         Launch the interview cue app
  interviewer-cue granola decrypt-cache   Decrypt and inspect the Granola cache
  interviewer-cue granola watch-cache     Watch Granola transcript cache changes
  interviewer-cue simulate-transcript     Run the transcript simulation sidecar
  interviewer-cue update                  Check for and install the latest package
`;
}

function createInterviewerCueCommand(): Command {
  return new Command("interviewer-cue")
    .exitOverride()
    .configureOutput({
      writeErr: () => {},
      writeOut: () => {},
    })
    .helpOption("-h, --help", "Show this help")
    .option("--no-update-check", "Skip the launch-time npm update check");
}

export function normalizeCommanderError(error: unknown): Error {
  if (error instanceof CommanderError) {
    return new Error(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
