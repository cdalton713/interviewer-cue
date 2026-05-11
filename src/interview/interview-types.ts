import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { z } from "zod";

export const interviewTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  systemPrompt: z.string(),
  qualities: z.array(z.string()),
  questionTypes: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const interviewTypesFileSchema = z.array(interviewTypeSchema);

export type InterviewType = z.infer<typeof interviewTypeSchema>;

export interface InterviewTypesPathOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

export function getInterviewTypesFilePath(
  options: InterviewTypesPathOptions = {},
): string {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const env = options.env ?? process.env;

  if (platform === "darwin") {
    return path.join(
      homeDir,
      "Library",
      "Application Support",
      "interviewer-cue",
      "interview-types.json",
    );
  }

  return path.join(
    env.XDG_CONFIG_HOME ?? path.join(homeDir, ".config"),
    "interviewer-cue",
    "interview-types.json",
  );
}

export function validateInterviewType(value: unknown): InterviewType {
  const result = interviewTypeSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid interview type: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export async function loadInterviewTypes(
  filePath = getInterviewTypesFilePath(),
): Promise<InterviewType[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }

  const parsed = JSON.parse(raw) as unknown;
  const result = interviewTypesFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid interview types file: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export async function saveInterviewTypes(
  interviewTypes: InterviewType[],
  filePath = getInterviewTypesFilePath(),
): Promise<void> {
  const validated = interviewTypesFileSchema.parse(interviewTypes);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
}

export function createInterviewType(input: {
  name: string;
  systemPrompt: string;
  qualities: string[];
  questionTypes: string[];
  now?: Date;
}): InterviewType {
  const now = (input.now ?? new Date()).toISOString();
  return validateInterviewType({
    id: slugify(input.name) || `interview-${Date.now()}`,
    name: input.name.trim(),
    systemPrompt: input.systemPrompt.trim(),
    qualities: normalizeStringList(input.qualities),
    questionTypes: normalizeStringList(input.questionTypes),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateInterviewType(
  existing: InterviewType,
  input: {
    name: string;
    systemPrompt: string;
    qualities: string[];
    questionTypes: string[];
    now?: Date;
  },
): InterviewType {
  return validateInterviewType({
    ...existing,
    name: input.name.trim(),
    systemPrompt: input.systemPrompt.trim(),
    qualities: normalizeStringList(input.qualities),
    questionTypes: normalizeStringList(input.questionTypes),
    updatedAt: (input.now ?? new Date()).toISOString(),
  });
}

export function parseCommaSeparatedList(value: string): string[] {
  return normalizeStringList(value.split(","));
}

function normalizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
