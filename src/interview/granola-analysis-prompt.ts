import type { InterviewQuestion } from "../ai/questions.js";
import type { InterviewSession } from "./interview-sessions.js";

export type CopyTextToClipboard = (text: string) => void | Promise<void>;

export function buildGranolaAnalysisPrompt(session: InterviewSession): string {
  const transcriptText = session.transcriptEvents
    .filter((event) => event.isFinal !== false)
    .map((event) => formatTranscriptLine(event.speaker, event.text))
    .filter(Boolean)

    .join("\n");
  const savedQuestions = [
    ...formatQuestions("General saved questions", session.generalQuestions),
    ...formatQuestions("Live saved questions", session.liveQuestions),
  ];

  return [
    "Review this interview and grade the interviewer's question quality.",
    "",
    "Instructions:",
    "- Identify every interviewer question asked in the interview.",
    "- Grade each interviewer question on a 1-5 scale.",
    "- For each grade, include the exact question text, score, rationale, and a stronger rewrite when useful.",
    "- Evaluate whether the questions tested the intended qualities and question types.",
    "- Call out missed follow-ups or weak lines of questioning.",
    "",
    "Interview context:",
    `Template: ${session.templateSnapshot.name}`,
    `System prompt: ${session.templateSnapshot.systemPrompt}`,
    `Qualities to evaluate: ${formatList(session.templateSnapshot.qualities)}`,
    `Question types: ${formatList(session.templateSnapshot.questionTypes)}`,
    "",
    "Saved interviewer-intent questions:",
    savedQuestions.length > 0 ? savedQuestions.join("\n") : "None saved.",
    "",
    "Transcript:",
    transcriptText || "No transcript text was saved in the app.",
  ].join("\n");
}

export function copyTextToTerminalClipboard(text: string): void {
  const encodedText = Buffer.from(text, "utf8").toString("base64");
  process.stdout.write(`\x1b]52;c;${encodedText}\x07`);
}

function formatQuestions(label: string, questions: InterviewQuestion[]): string[] {
  if (questions.length === 0) return [];
  return [
    `${label}:`,
    ...questions.map((question, index) => `${index + 1}. ${question.question}`),
  ];
}

function formatTranscriptLine(speaker: string | undefined, text: string): string {
  const trimmedText = text.trim();
  if (!trimmedText) return "";
  const trimmedSpeaker = speaker?.trim();
  return trimmedSpeaker ? `${trimmedSpeaker}: ${trimmedText}` : trimmedText;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}
