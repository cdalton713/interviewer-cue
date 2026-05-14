export interface ReleaseOptions {
  bump: "patch" | "minor" | "major" | `${number}.${number}.${number}`;
  dryRun: boolean;
  otp?: string;
  publish: boolean;
  push: boolean;
  skipVerify: boolean;
}

export interface ReleaseStep {
  label: string;
  command?: string[];
  dryRunOnly?: boolean;
}

export function parseReleaseArgs(argv: string[]): ReleaseOptions;
export function buildReleasePlan(options: ReleaseOptions): ReleaseStep[];
