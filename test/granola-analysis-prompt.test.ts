import { describe, expect, it } from "vitest";

import { buildGranolaAnalysisPrompt } from "../src/interview/granola-analysis-prompt.js";
import type { InterviewSession } from "../src/interview/interview-sessions.js";

describe("Granola analysis prompt", () => {
  it("includes transcript context, saved questions, and grading instructions", () => {
    const prompt = buildGranolaAnalysisPrompt(session);

    expect(prompt).toContain("Review this interview");
    expect(prompt).toContain("Technical Interview");
    expect(prompt).toContain("Assess technical depth.");
    expect(prompt).toContain("Grade each interviewer question");
    expect(prompt).toContain("include the exact question text");
    expect(prompt).toContain("Candidate described a queue migration.");
    expect(prompt).toContain("What tradeoff mattered most?");
    expect(prompt).toContain("What risk did the queue introduce?");
  });

  it("labels transcript lines with interviewer and candidate speakers", () => {
    const prompt = buildGranolaAnalysisPrompt({
      ...session,
      transcriptEvents: [
        {
          type: "transcript",
          id: "docA:utt1",
          documentId: "docA",
          utteranceId: "utt1",
          speaker: "Interviewer",
          text: "Can you walk me through the migration?",
          observedAt: "2026-05-11T00:01:00.000Z",
          isFinal: true,
        },
        {
          type: "transcript",
          id: "docA:utt2",
          documentId: "docA",
          utteranceId: "utt2",
          speaker: "Candidate",
          text: "We moved writes onto a durable queue.",
          observedAt: "2026-05-11T00:02:00.000Z",
          isFinal: true,
        },
      ],
    });

    expect(prompt).toContain("Interviewer: Can you walk me through the migration?");
    expect(prompt).toContain("Candidate: We moved writes onto a durable queue.");
  });
});

const session: InterviewSession = {
  id: "session-1",
  status: "completed",
  templateId: "technical",
  templateSnapshot: {
    id: "technical",
    name: "Technical Interview",
    systemPrompt: "Assess technical depth.",
    qualities: ["debugging", "architecture"],
    questionTypes: ["systems", "behavioral"],
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },
  transcriptEvents: [
    {
      type: "transcript",
      id: "docA:utt1",
      documentId: "docA",
      utteranceId: "utt1",
      text: "Candidate described a queue migration.",
      observedAt: "2026-05-11T00:01:00.000Z",
      isFinal: true,
    },
  ],
  generalQuestions: [{ question: "What tradeoff mattered most?" }],
  liveQuestions: [{ question: "What risk did the queue introduce?" }],
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:01:00.000Z",
  completedAt: "2026-05-11T00:02:00.000Z",
};
