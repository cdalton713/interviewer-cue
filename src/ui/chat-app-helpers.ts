import type { Key } from "ink";

import type {
  ConsoleEvent,
  TranscriptConsoleEvent,
} from "../conversation/types.js";
import {
  FULL_STACK_SYSTEM_PROMPT_DEFAULTS,
  type DefaultSystemPrompt,
} from "../interview/default-system-prompts.js";
import {
  parseCommaSeparatedList,
  type InterviewType,
} from "../interview/interview-types.js";
import { editorFields } from "./chat-app-options.js";
import type { AppMode, DraftInterviewType, EditorState } from "./chat-app-types.js";

export function draftFromInterviewType(interviewType: InterviewType): DraftInterviewType {
  return {
    name: interviewType.name,
    systemPrompt: interviewType.systemPrompt,
    qualities: interviewType.qualities.join(", "),
    questionTypes: interviewType.questionTypes.join(", "),
  };
}

export function draftFromDefaultSystemPrompt(prompt: DefaultSystemPrompt): DraftInterviewType {
  return {
    name: prompt.name,
    systemPrompt: prompt.systemPrompt,
    qualities: prompt.qualities.join(", "),
    questionTypes: prompt.questionTypes.join(", "),
  };
}

export function getDefaultSystemPrompt(index: number): DefaultSystemPrompt {
  const fallback = FULL_STACK_SYSTEM_PROMPT_DEFAULTS[0];
  if (!fallback) {
    throw new Error("At least one default system prompt is required");
  }
  return FULL_STACK_SYSTEM_PROMPT_DEFAULTS[index] ?? fallback;
}

export function updateDraftField(
  state: Extract<EditorState, { mode: "new" | "edit" }>,
  update: (value: string) => string,
): Extract<EditorState, { mode: "new" | "edit" }> {
  const field = editorFields[state.fieldIndex] ?? "name";
  return {
    ...state,
    draft: {
      ...state.draft,
      [field]: update(state.draft[field]),
    },
  };
}

export function draftToInterviewTypeInput(draft: DraftInterviewType) {
  return {
    name: draft.name,
    systemPrompt: draft.systemPrompt,
    qualities: parseCommaSeparatedList(draft.qualities),
    questionTypes: parseCommaSeparatedList(draft.questionTypes),
  };
}

export function isMissingFileError(error: unknown, filePath: string): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false;
  const fileError = error as Error & { code?: string; path?: string };
  return (
    fileError.code === "ENOENT" &&
    (fileError.path === undefined || fileError.path === filePath)
  );
}

export function onlyTranscriptEvents(events: ConsoleEvent[]): TranscriptConsoleEvent[] {
  return events.filter((event): event is TranscriptConsoleEvent => event.type === "transcript");
}

export function isLiveGenerationTranscriptEvent(
  event: TranscriptConsoleEvent,
): boolean {
  return event.isFinal !== false && event.speaker?.trim().toLowerCase() !== "microphone";
}

export function buildLiveGenerationPromptTranscriptText(
  events: TranscriptConsoleEvent[],
  options: { maxUtterances?: number; maxChars?: number } = {},
): string {
  const maxUtterances = options.maxUtterances ?? 12;
  const maxChars = options.maxChars ?? 4000;
  if (maxUtterances <= 0 || maxChars <= 0) return "";

  const promptText = events
    .filter(isLiveGenerationTranscriptEvent)
    .map((event) => event.text.trim())
    .filter(Boolean)
    .slice(-maxUtterances)
    .join("\n");

  if (promptText.length <= maxChars) return promptText;
  return promptText.slice(-maxChars);
}

export function nextIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return (index + 1) % length;
}

export function previousIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return (index - 1 + length) % length;
}

export function isNextSelection(input: string, key: Key): boolean {
  return input === "j" || key.downArrow;
}

export function isPreviousSelection(input: string, key: Key): boolean {
  return input === "k" || key.upArrow;
}

export function getFirstVisibleQuestionIndex(
  selectedIndex: number,
  questionCount: number,
  maxVisibleQuestions: number,
): number {
  if (questionCount <= maxVisibleQuestions) return 0;
  return Math.min(
    Math.max(selectedIndex - maxVisibleQuestions + 1, 0),
    questionCount - maxVisibleQuestions,
  );
}

export function maskSecret(value: string): string {
  if (!value) return " ";
  return "*".repeat(Math.min(value.length, 24));
}

export function modeLabel(mode: AppMode): string {
  switch (mode) {
    case "dashboard":
      return "Dashboard";
    case "new":
      return "New Interview";
    case "live":
      return "Live Interview";
    case "past":
      return "Past Interviews";
    case "pastDetail":
      return "Past Interview";
    case "settings":
      return "Settings";
  }
}
