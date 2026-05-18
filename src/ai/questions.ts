import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

import { generateText, Output } from "ai";
import { z } from "zod";

import type { InterviewType } from "../interview/interview-types.js";
import {
  assertModelHasCredentials,
  parseModelId,
  resolveLanguageModel,
  type ApiKeySettings,
} from "./provider-registry.js";
import { createNoopAppLogger, type AppLogger } from "../logging/app-log.js";

const execFileAsync = promisify(execFile);

export const interviewQuestionSchema = z.object({
  question: z.string().min(1),
  rationale: z.string().optional(),
  focus: z.string().optional(),
  pinned: z.boolean().optional(),
});

export const interviewQuestionsSchema = z.object({
  questions: z.array(interviewQuestionSchema).min(1),
});

export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewQuestionsResult = z.infer<typeof interviewQuestionsSchema>;

const generatedInterviewQuestionSchema = z.object({
  question: z.string().min(1),
  rationale: z.string().nullable(),
  focus: z.string().nullable(),
});

const generatedInterviewQuestionsSchema = z.object({
  questions: z.array(generatedInterviewQuestionSchema).min(1),
});

type GeneratedInterviewQuestionsResult = z.infer<
  typeof generatedInterviewQuestionsSchema
>;

export interface QuestionGenerationDependencies {
  readFile?: (filePath: string) => Promise<Buffer>;
  extractPdfText?: (filePath: string) => Promise<string | null>;
  logger?: AppLogger;
  performanceNow?: () => number;
}

export async function generateResumeQuestions(
  input: {
    apiKeys?: ApiKeySettings;
    modelId: string;
    interviewType: InterviewType;
    resumePath: string;
    requestId?: string;
    sessionId?: string;
  },
  dependencies: QuestionGenerationDependencies = {},
): Promise<InterviewQuestion[]> {
  const readFile = dependencies.readFile ?? fs.readFile;
  const extractPdfText = dependencies.extractPdfText ?? extractPdfTextWithPdftotext;
  const logger = dependencies.logger ?? createNoopAppLogger();
  const performanceNow = dependencies.performanceNow ?? (() => performance.now());
  const requestId = input.requestId ?? createAiRequestId("resume");
  const resumeText = await extractPdfText(input.resumePath);
  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Buffer; mediaType: string; filename: string }
  > = [
    {
      type: "text",
      text: buildResumeQuestionPrompt(
        input.interviewType,
        path.basename(input.resumePath),
      ),
    },
  ];

  if (resumeText) {
    content.push({
      type: "text",
      text: `Extracted resume text:\n${resumeText}`,
    });
  } else {
    const resumeBytes = await readFile(input.resumePath);
    content.push({
      type: "file",
      data: resumeBytes,
      mediaType: "application/pdf",
      filename: path.basename(input.resumePath),
    });
  }

  assertModelHasCredentials(input.modelId, input.apiKeys);

  const { provider, model } = parseModelId(input.modelId);
  const startedAt = performanceNow();
  logger.log({
    event: "ai.api_call.started",
    requestId,
    sessionId: input.sessionId,
    callType: "resume_questions",
    provider,
    model,
    modelId: input.modelId,
    interviewTypeId: input.interviewType.id,
    interviewTypeName: input.interviewType.name,
    resumeFileName: path.basename(input.resumePath),
    resumeTextChars: resumeText?.length ?? 0,
    sentFilePart: !resumeText,
  });

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: resolveLanguageModel(input.modelId, input.apiKeys),
      output: createQuestionsOutput("interview_questions"),
      messages: [
        {
          role: "user",
          content,
        },
      ],
    });
  } catch (error) {
    logger.log({
      level: "error",
      event: "ai.api_call.failed",
      requestId,
      sessionId: input.sessionId,
      callType: "resume_questions",
      provider,
      model,
      modelId: input.modelId,
      durationMs: Math.round(performanceNow() - startedAt),
      ...formatErrorForLog(error),
    });
    throw error;
  }

  const questions = normalizeGeneratedQuestions(result.output.questions);
  logger.log({
    event: "ai.api_call.succeeded",
    requestId,
    sessionId: input.sessionId,
    callType: "resume_questions",
    provider,
    model,
    modelId: input.modelId,
    durationMs: Math.round(performanceNow() - startedAt),
    questionCount: questions.length,
  });

  return questions;
}

export async function generateLiveQuestions(
  input: {
    apiKeys?: ApiKeySettings;
    modelId: string;
    interviewType: InterviewType;
    transcriptText: string;
    pinnedQuestions?: InterviewQuestion[];
    requestId?: string;
    sessionId?: string;
  },
  dependencies: QuestionGenerationDependencies = {},
): Promise<InterviewQuestion[]> {
  const logger = dependencies.logger ?? createNoopAppLogger();
  const performanceNow = dependencies.performanceNow ?? (() => performance.now());
  const requestId = input.requestId ?? createAiRequestId("live");
  assertModelHasCredentials(input.modelId, input.apiKeys);

  const { provider, model } = parseModelId(input.modelId);
  const startedAt = performanceNow();
  logger.log({
    event: "ai.api_call.started",
    requestId,
    sessionId: input.sessionId,
    callType: "live_questions",
    provider,
    model,
    modelId: input.modelId,
    interviewTypeId: input.interviewType.id,
    interviewTypeName: input.interviewType.name,
    transcriptChars: input.transcriptText.length,
    pinnedQuestionCount: input.pinnedQuestions?.length ?? 0,
  });

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: resolveLanguageModel(input.modelId, input.apiKeys),
      output: createQuestionsOutput("live_interview_questions"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildLiveQuestionPrompt(
                input.interviewType,
                input.transcriptText,
                input.pinnedQuestions,
              ),
            },
          ],
        },
      ],
    });
  } catch (error) {
    logger.log({
      level: "error",
      event: "ai.api_call.failed",
      requestId,
      sessionId: input.sessionId,
      callType: "live_questions",
      provider,
      model,
      modelId: input.modelId,
      durationMs: Math.round(performanceNow() - startedAt),
      ...formatErrorForLog(error),
    });
    throw error;
  }

  const questions = normalizeGeneratedQuestions(result.output.questions);
  logger.log({
    event: "ai.api_call.succeeded",
    requestId,
    sessionId: input.sessionId,
    callType: "live_questions",
    provider,
    model,
    modelId: input.modelId,
    durationMs: Math.round(performanceNow() - startedAt),
    questionCount: questions.length,
  });

  return questions;
}

export function buildResumeQuestionPrompt(
  interviewType: InterviewType,
  resumeFileName: string,
): string {
  return [
    "Generate concise pre-interview questions for this candidate resume.",
    `Template: ${interviewType.name}`,
    `System prompt: ${interviewType.systemPrompt}`,
    `Qualities to evaluate: ${formatList(interviewType.qualities)}`,
    `Question types to include: ${formatList(interviewType.questionTypes)}`,
    `Resume file: ${resumeFileName}`,
    "Return practical interviewer questions with a short rationale and focus label.",
  ].join("\n");
}

export function buildLiveQuestionPrompt(
  interviewType: InterviewType,
  transcriptText: string,
  pinnedQuestions: InterviewQuestion[] = [],
): string {
  const promptSections = [
    "You are a live interview co-pilot helping a human interviewer use Granola transcript context during an active interview.",
    "Generate concise, immediately askable follow-up questions from the recent final transcript context.",
    `Template: ${interviewType.name}`,
    `System prompt: ${interviewType.systemPrompt}`,
    `Qualities to evaluate: ${formatList(interviewType.qualities)}`,
    `Question types to include: ${formatList(interviewType.questionTypes)}`,
  ];

  const pinnedQuestionLines = pinnedQuestions
    .map((question, index) => formatPinnedQuestion(question, index))
    .filter(Boolean);

  if (pinnedQuestionLines.length > 0) {
    promptSections.push(
      "Pinned interviewer questions:",
      "Treat these as saved interviewer intent.",
      "Do not repeat pinned questions.",
      "Generate concise, immediately askable follow-ups that complement pinned items and the latest transcript.",
      ...pinnedQuestionLines,
    );
  }

  promptSections.push(
    "Recent final transcript:",
    transcriptText,
    "Return questions that help the interviewer probe what was just discussed.",
  );

  return promptSections.join("\n");
}

function formatList(values: string[]): string {
  return values.length === 0 ? "none specified" : values.join(", ");
}

function formatPinnedQuestion(question: InterviewQuestion, index: number): string {
  const details = [question.focus, question.rationale].filter(Boolean).join("; ");
  return details
    ? `${index + 1}. ${question.question} (${details})`
    : `${index + 1}. ${question.question}`;
}

function normalizeGeneratedQuestions(
  questions: GeneratedInterviewQuestionsResult["questions"],
): InterviewQuestion[] {
  return questions.map((question) =>
    interviewQuestionSchema.parse({
      question: question.question,
      rationale: question.rationale ?? undefined,
      focus: question.focus ?? undefined,
    }),
  );
}

function createQuestionsOutput(name: string) {
  return Output.object({
    schema: generatedInterviewQuestionsSchema,
    name,
  });
}

async function extractPdfTextWithPdftotext(filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", filePath, "-"],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    const text = stdout.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function createAiRequestId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorName: "NonError",
    errorMessage: String(error),
  };
}
