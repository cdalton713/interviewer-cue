import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { z } from "zod";

import { interviewQuestionSchema, type InterviewQuestion } from "../ai/questions.js";
import {
  interviewTypeSchema,
  type InterviewType,
  type InterviewTypesPathOptions,
} from "./interview-types.js";

const transcriptConsoleEventSchema = z.object({
  type: z.literal("transcript"),
  id: z.string().min(1),
  documentId: z.string().min(1),
  utteranceId: z.string().min(1),
  text: z.string(),
  speaker: z.string().optional(),
  observedAt: z.string().datetime(),
  startTimestamp: z.string().optional(),
  endTimestamp: z.string().optional(),
  isFinal: z.boolean().optional(),
});

export const interviewSessionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["active", "completed"]),
  candidateName: z.string().min(1).optional(),
  templateId: z.string().min(1),
  templateSnapshot: interviewTypeSchema,
  resumePath: z.string().optional(),
  transcriptEvents: z.array(transcriptConsoleEventSchema),
  generalQuestions: z.array(interviewQuestionSchema),
  liveQuestions: z.array(interviewQuestionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

const interviewSessionsFileSchema = z.array(interviewSessionSchema);
const saveQueues = new Map<string, Promise<void>>();

export type InterviewSession = Omit<
  z.infer<typeof interviewSessionSchema>,
  "templateSnapshot" | "generalQuestions" | "liveQuestions"
> & {
  templateSnapshot: InterviewType;
  generalQuestions: InterviewQuestion[];
  liveQuestions: InterviewQuestion[];
};

export function getInterviewSessionsFilePath(
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
      "interview-sessions.json",
    );
  }

  return path.join(
    env.XDG_CONFIG_HOME ?? path.join(homeDir, ".config"),
    "interviewer-cue",
    "interview-sessions.json",
  );
}

export function validateInterviewSession(value: unknown): InterviewSession {
  const result = interviewSessionSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid interview session: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export async function loadInterviewSessions(
  filePath = getInterviewSessionsFilePath(),
): Promise<InterviewSession[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }

  const parsed = JSON.parse(raw) as unknown;
  const result = interviewSessionsFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid interview sessions file: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export async function saveInterviewSessions(
  interviewSessions: InterviewSession[],
  filePath = getInterviewSessionsFilePath(),
): Promise<void> {
  const validated = interviewSessionsFileSchema.parse(interviewSessions);
  await enqueueSave(filePath, async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  });
}

export function createInterviewSession(input: {
  template: InterviewType;
  candidateName?: string;
  resumePath?: string;
  now?: Date;
}): InterviewSession {
  const now = (input.now ?? new Date()).toISOString();
  const candidateName = input.candidateName?.trim() || undefined;
  return validateInterviewSession({
    id: `session-${Date.now()}`,
    status: "active",
    candidateName,
    templateId: input.template.id,
    templateSnapshot: input.template,
    resumePath: input.resumePath,
    transcriptEvents: [],
    generalQuestions: [],
    liveQuestions: [],
    createdAt: now,
    updatedAt: now,
  });
}

export function completeActiveSessions(
  sessions: InterviewSession[],
  now = new Date(),
): InterviewSession[] {
  const timestamp = now.toISOString();
  return sessions.map((session) =>
    session.status === "active"
      ? { ...session, status: "completed", updatedAt: timestamp, completedAt: timestamp }
      : session,
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function enqueueSave(filePath: string, save: () => Promise<void>): Promise<void> {
  const previousSave = saveQueues.get(filePath) ?? Promise.resolve();
  const nextSave = previousSave.catch(() => undefined).then(save);
  saveQueues.set(filePath, nextSave);

  try {
    await nextSave;
  } finally {
    if (saveQueues.get(filePath) === nextSave) {
      saveQueues.delete(filePath);
    }
  }
}
