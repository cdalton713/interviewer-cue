import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildLiveQuestionPrompt,
  buildResumeQuestionPrompt,
  generateLiveQuestions,
  generateResumeQuestions,
} from "../src/ai/questions.js";
import type { InterviewType } from "../src/interview/interview-types.js";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

const interviewType: InterviewType = {
  id: "technical",
  name: "Technical Interview",
  systemPrompt: "Assess backend engineering depth.",
  qualities: ["debugging", "system design"],
  questionTypes: ["behavioral", "technical deep dive"],
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:00:00.000Z",
};

const apiKeys = {
  openaiApiKey: "openai-key",
  googleGenerativeAiApiKey: "google-key",
  anthropicApiKey: "anthropic-key",
  anthropicAuthToken: "",
};

type MockGenerateTextOptions = {
  model: { modelId?: string };
  messages: [{ content: unknown }, ...Array<{ content: unknown }>];
  output: {
    responseFormat: Promise<{
      type: "json";
      name?: string;
      schema?: {
        properties: { questions: { items: { required?: string[] } } };
      };
    }>;
  };
};

type MockGenerateTextResult = {
  output: {
    questions: Array<{
      question: string;
      rationale?: string | null;
      focus?: string | null;
    }>;
  };
};

const generateTextMock = vi.mocked(generateText) as unknown as {
  mockReset: () => void;
  mockResolvedValue: (result: MockGenerateTextResult) => void;
  mock: { calls: Array<[MockGenerateTextOptions]> };
};

function getGenerateTextOptions(): MockGenerateTextOptions {
  const options = generateTextMock.mock.calls.at(-1)?.[0];
  if (!options) throw new Error("generateText was not called");
  return options;
}

describe("question generation", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it("builds resume prompts from the interview type and resume context", () => {
    const prompt = buildResumeQuestionPrompt(interviewType, "resume.pdf");

    expect(prompt).toContain("Assess backend engineering depth.");
    expect(prompt).toContain("debugging");
    expect(prompt).toContain("technical deep dive");
    expect(prompt).toContain("resume.pdf");
  });

  it("builds live prompts from final transcript context", () => {
    const prompt = buildLiveQuestionPrompt(
      interviewType,
      "Candidate described scaling a PostgreSQL queue.",
    );

    expect(prompt).toContain("Assess backend engineering depth.");
    expect(prompt).toContain("system design");
    expect(prompt).toContain("Candidate described scaling a PostgreSQL queue.");
  });

  it("frames live prompts as a Granola interview co-pilot", () => {
    const prompt = buildLiveQuestionPrompt(
      interviewType,
      "Candidate described scaling a PostgreSQL queue.",
    );

    expect(prompt).toContain("live interview co-pilot");
    expect(prompt).toContain("human interviewer");
    expect(prompt).toContain("Granola transcript context");
  });

  it("includes pinned interviewer questions in live prompts and avoids repeats", () => {
    const prompt = buildLiveQuestionPrompt(
      interviewType,
      "Candidate described scaling a PostgreSQL queue.",
      [
        {
          question: "What failure mode worried you most?",
          rationale: "Saved by the interviewer.",
          focus: "resilience",
          pinned: true,
        },
      ],
    );

    expect(prompt).toContain("Pinned interviewer questions");
    expect(prompt).toContain("What failure mode worried you most?");
    expect(prompt).toContain("Treat these as saved interviewer intent.");
    expect(prompt).toContain("Do not repeat pinned questions.");
  });

  it("sends resume PDFs as AI SDK file message parts", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "granola-resume-"));
    const resumePath = path.join(dir, "resume.pdf");
    const pdfBytes = Buffer.from("%PDF-1.4\n");
    await fs.writeFile(resumePath, pdfBytes);
    generateTextMock.mockResolvedValue({
      output: {
        questions: [
          {
            question: "How did you debug the migration?",
            rationale: "Tests practical debugging depth.",
            focus: "debugging",
          },
        ],
      },
    });

    const questions = await generateResumeQuestions(
      {
        apiKeys,
        modelId: "openai:gpt-5",
        interviewType,
        resumePath,
      },
      { extractPdfText: async () => null },
    );

    expect(questions).toHaveLength(1);
    const options = getGenerateTextOptions();
    expect(options.model.modelId).toBe("gpt-5");
    expect(options.messages[0].content).toContainEqual({
      type: "file",
      data: pdfBytes,
      mediaType: "application/pdf",
      filename: "resume.pdf",
    });
  });

  it("prefers extracted resume text over PDF file message parts", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        questions: [
          {
            question: "What architecture tradeoff did this resume project involve?",
          },
        ],
      },
    });

    const questions = await generateResumeQuestions(
      {
        apiKeys,
        modelId: "openai:gpt-5",
        interviewType,
        resumePath: "/tmp/resume.pdf",
      },
      {
        extractPdfText: async () => "Built a PostgreSQL queue worker.",
      },
    );

    expect(questions).toHaveLength(1);
    const options = getGenerateTextOptions();
    expect(JSON.stringify(options.messages)).toContain("Built a PostgreSQL queue worker.");
    expect(JSON.stringify(options.messages)).not.toContain('"type":"file"');
  });

  it("generates live questions with transcript context and no file parts", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        questions: [
          {
            question: "What tradeoff did the queue introduce?",
            rationale: "Probes system design judgment.",
            focus: "system design",
          },
        ],
      },
    });

    await generateLiveQuestions(
      {
        apiKeys,
        modelId: "anthropic:claude-sonnet-4-5",
        interviewType,
        transcriptText: "We used a queue to smooth write bursts.",
        pinnedQuestions: [
          {
            question: "What failure mode worried you most?",
            pinned: true,
          },
        ],
      },
    );

    const options = getGenerateTextOptions();
    expect(options.model.modelId).toBe("claude-sonnet-4-5");
    expect(JSON.stringify(options.messages)).not.toContain('"type":"file"');
    expect(JSON.stringify(options.messages)).toContain("smooth write bursts");
    expect(JSON.stringify(options.messages)).toContain("What failure mode worried you most?");
  });

  it("fails before calling the AI provider when live model credentials are missing", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        questions: [
          {
            question: "This should not be generated.",
            rationale: null,
            focus: null,
          },
        ],
      },
    });

    await expect(
      generateLiveQuestions(
        {
          apiKeys: {
            openaiApiKey: "openai-key",
            googleGenerativeAiApiKey: "",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          modelId: "google:gemini-2.5-flash",
          interviewType,
          transcriptText: "We used a queue to smooth write bursts.",
        },
      ),
    ).rejects.toThrow(
      "Missing Google Generative AI API key for google:gemini-2.5-flash.",
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("uses generateText output with an OpenAI-compatible strict schema for generated question fields", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        questions: [
          {
            question: "What tradeoff did the queue introduce?",
            rationale: null,
            focus: null,
          },
        ],
      },
    });

    const questions = await generateLiveQuestions(
      {
        apiKeys,
        modelId: "openai:gpt-5",
        interviewType,
        transcriptText: "We used a queue to smooth write bursts.",
      },
    );

    const options = getGenerateTextOptions();
    const responseFormat = await options.output.responseFormat;
    if (!responseFormat.schema) {
      throw new Error("generateText output did not include a JSON schema");
    }
    const jsonSchema = responseFormat.schema;
    const questionItemSchema = jsonSchema.properties.questions.items;

    expect(responseFormat.name).toBe("live_interview_questions");
    expect(questionItemSchema.required).toEqual(["question", "rationale", "focus"]);
    expect(questions).toEqual([{ question: "What tradeoff did the queue introduce?" }]);
  });
});
