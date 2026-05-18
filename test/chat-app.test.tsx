import React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";

import type { InterviewQuestion } from "../src/ai/questions.js";
import type {
  GranolaEventSource,
  GranolaEventSourceCallbacks,
} from "../src/granola/event-source.js";
import type { InterviewSession } from "../src/interview/interview-sessions.js";
import type { InterviewType } from "../src/interview/interview-types.js";
import { ChatApp } from "../src/ui/ChatApp.js";

describe("ChatApp", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens to the dashboard by default", async () => {
    const fake = createFakeEventSource();
    const { lastFrame } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);

    expect(fake.start).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("Dashboard");
    expect(lastFrame()).toContain("n New Interview");
    expect(lastFrame()).toContain("p Past Interviews");
    expect(lastFrame()).toContain("s Settings");
    expect(lastFrame()).not.toContain("Waiting for new transcript changes");
  });

  it("opens New Interview with a preselected resume when only --resume is supplied", async () => {
    const fake = createFakeEventSource();
    const { lastFrame } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        resumePath="/tmp/resume.pdf"
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);

    expect(lastFrame()).toContain("New Interview");
    expect(lastFrame()).toContain("Technical Interview");
    expect(lastFrame()).toContain("/tmp/resume.pdf");
  });

  it("shows an error in New Interview when no templates exist", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => []}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "n");
    await wait(20);

    expect(fake.start).not.toHaveBeenCalled();
    expect(stripAnsi(lastFrame() ?? "")).toContain("New Interview");
    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "No interview templates yet. Create one in Settings first.",
    );
  });

  it("starts a new interview from the template picker and saves an active session", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
      />,
    );

    await wait(0);
    await typeText(stdin, "n\r");
    await wait(20);

    expect(saveInterviewSessions).toHaveBeenCalledWith([
      expect.objectContaining({
        status: "active",
        templateId: "technical",
        templateSnapshot: technicalTemplate,
      }),
    ]);
    expect(fake.start).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain("Live Interview");
    expect(lastFrame()).toContain("Technical Interview");
  });

  it("captures a candidate name before starting a new interview", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
      />,
    );

    await wait(0);
    await typeText(stdin, "ncAda Lovelace\r\r");
    await wait(20);

    expect(saveInterviewSessions).toHaveBeenCalledWith([
      expect.objectContaining({
        candidateName: "Ada Lovelace",
        status: "active",
        templateId: "technical",
      }),
    ]);
    expect(lastFrame()).toContain("Live Interview");
  });

  it("navigates New Interview templates with arrow keys", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate, systemDesignTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "n");
    await wait(20);

    stdin.write("\x1B[B");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain("> System Design Interview");
  });

  it("navigates Past Interviews with arrow keys", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [completedSession, olderCompletedSession]}
      />,
    );

    await wait(0);
    await typeText(stdin, "p");
    await wait(20);

    stdin.write("\x1B[B");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "> Technical Interview · 2026-05-10T00:03:00.000Z · completed",
    );
  });

  it("shows candidate names in the past interviews list", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [
          { ...completedSession, candidateName: "Grace Hopper" },
        ]}
      />,
    );

    await wait(0);
    await typeText(stdin, "p");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "> Grace Hopper · Technical Interview · 2026-05-11T00:03:00.000Z · completed",
    );
  });

  it("uses the injected resume picker before starting a new interview", async () => {
    const fake = createFakeEventSource();
    const chooseResumeFile = vi.fn().mockResolvedValue("/tmp/picked.pdf");
    const generateResumeQuestions = vi.fn(
      () => new Promise<Array<{ question: string }>>(() => {}),
    );
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
        chooseResumeFile={chooseResumeFile}
        generateResumeQuestions={generateResumeQuestions}
      />,
    );

    await wait(0);
    await typeText(stdin, "nr\r");
    await wait(20);

    expect(chooseResumeFile).toHaveBeenCalledOnce();
    expect(saveInterviewSessions).toHaveBeenCalledWith([
      expect.objectContaining({ resumePath: "/tmp/picked.pdf" }),
    ]);
    await waitForExpectation(() => expect(lastFrame()).toContain("/tmp/picked.pdf"));
  });

  it("starts with the picked resume when enter is pressed while the resume picker is resolving", async () => {
    const fake = createFakeEventSource();
    let resolveResumeFile: (filePath: string) => void = () => {};
    const chooseResumeFile = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveResumeFile = resolve;
        }),
    );
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const { stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
        chooseResumeFile={chooseResumeFile}
      />,
    );

    await wait(0);
    await typeText(stdin, "nr");
    stdin.write("\r");
    resolveResumeFile("/tmp/picked.pdf");
    await wait(20);

    expect(saveInterviewSessions).toHaveBeenCalledWith([
      expect.objectContaining({ resumePath: "/tmp/picked.pdf" }),
    ]);
    expect(fake.start).toHaveBeenCalledOnce();
  });

  it("ignores a canceled resume picker and still starts the interview on enter", async () => {
    const fake = createFakeEventSource();
    const chooseResumeFile = vi
      .fn()
      .mockRejectedValue(new Error("User canceled. (-128)"));
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
        chooseResumeFile={chooseResumeFile}
      />,
    );

    await wait(0);
    await typeText(stdin, "nr");
    await wait(20);

    expect(chooseResumeFile).toHaveBeenCalledOnce();
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("AI error:");

    await typeText(stdin, "\r");
    await wait(20);

    expect(saveInterviewSessions).toHaveBeenCalledWith([
      expect.objectContaining({ resumePath: undefined }),
    ]);
    expect(fake.start).toHaveBeenCalledOnce();
  });

  it("generates and displays general questions for a resume-backed interview", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const generateResumeQuestions = vi.fn().mockResolvedValue([
      {
        question: "What technical decision on the resume had the most tradeoffs?",
        rationale: "Probes resume-specific judgment.",
        focus: "architecture",
      },
    ]);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadAppSettings={async () => ({
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
          apiKeys: {
            openaiApiKey: "openai-key",
            googleGenerativeAiApiKey: "",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
        chooseResumeFile={async () => "/tmp/picked.pdf"}
        generateResumeQuestions={generateResumeQuestions}
      />,
    );

    await wait(0);
    await typeText(stdin, "nr\r");
    await wait(20);

    expect(generateResumeQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeys: {
          openaiApiKey: "openai-key",
          googleGenerativeAiApiKey: "",
          anthropicApiKey: "",
          anthropicAuthToken: "",
        },
        modelId: "openai:gpt-5",
        interviewType: technicalTemplate,
        resumePath: "/tmp/picked.pdf",
      }),
    );
    expect(lastFrame()).toContain("general questions");
    expect(lastFrame()).toContain("What technical decision");
    expect(saveInterviewSessions).toHaveBeenLastCalledWith([
      expect.objectContaining({
        resumePath: "/tmp/picked.pdf",
        generalQuestions: [
          expect.objectContaining({
            question: "What technical decision on the resume had the most tradeoffs?",
          }),
        ],
      }),
    ]);
  });

  it("clears a stale resume path when the resume file is missing", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const missingResumeError = Object.assign(
      new Error("ENOENT: no such file or directory, open '/tmp/picked.pdf'"),
      { code: "ENOENT", path: "/tmp/picked.pdf" },
    );
    const generateResumeQuestions = vi.fn().mockRejectedValue(missingResumeError);
    const { lastFrame } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        resumePath="/tmp/picked.pdf"
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
          apiKeys: {
            openaiApiKey: "openai-key",
            googleGenerativeAiApiKey: "",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
        generateResumeQuestions={generateResumeQuestions}
      />,
    );

    await waitForExpectation(() => expect(generateResumeQuestions).toHaveBeenCalledOnce());
    await waitForExpectation(() => {
      expect(stripAnsi(lastFrame() ?? "")).not.toContain("AI error:");
      expect(stripAnsi(lastFrame() ?? "")).not.toContain("/tmp/picked.pdf");
      expect(saveInterviewSessions).toHaveBeenLastCalledWith([
        expect.objectContaining({
          resumePath: undefined,
          generalQuestions: [],
        }),
      ]);
    });
  });

  it("animates the AI loading indicator while question generation is in flight", async () => {
    vi.useFakeTimers();
    const fake = createFakeEventSource();
    const generateResumeQuestions = vi.fn(
      () => new Promise<Array<{ question: string }>>(() => {}),
    );
    const { lastFrame } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        resumePath="/tmp/resume.pdf"
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
          apiKeys: {
            openaiApiKey: "openai-key",
            googleGenerativeAiApiKey: "",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={vi.fn().mockResolvedValue(undefined)}
        generateResumeQuestions={generateResumeQuestions}
      />,
    );

    await flushEffects(4);

    expect(generateResumeQuestions).toHaveBeenCalledOnce();
    expect(stripAnsi(lastFrame() ?? "")).toContain("AI Loading -");

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(stripAnsi(lastFrame() ?? "")).toContain("AI Loading \\");
  });

  it("auto-starts a live interview when --interview-type is supplied", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const { lastFrame } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        resumePath="/tmp/resume.pdf"
        initialInterviewTypeId="technical"
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
      />,
    );

    await wait(20);

    expect(fake.start).toHaveBeenCalledOnce();
    expect(saveInterviewSessions).toHaveBeenCalledWith([
      expect.objectContaining({
        status: "active",
        templateId: "technical",
        resumePath: "/tmp/resume.pdf",
      }),
    ]);
    expect(lastFrame()).toContain("Live Interview");
  });

  it("resumes an existing active interview from the dashboard", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [activeSession]}
      />,
    );

    await wait(0);
    expect(lastFrame()).toContain("l Live Interview");

    await typeText(stdin, "l");
    await wait(0);

    expect(fake.start).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain("Live Interview");
    expect(lastFrame()).toContain("Existing words.");
    expect(lastFrame()).toContain("Saved resume question?");
  });

  it("uses terminal-default foreground for primary transcript and question text", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [activeSession]}
      />,
    );

    await wait(0);
    await typeText(stdin, "l");
    await wait(0);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Existing words.");
    expect(frame).toContain("Saved resume question?");
    expect(frame).not.toContain("\x1B[37mExisting words.");
    expect(frame).not.toContain("\x1B[37m  1. Saved resume question?");
  });

  it("marks the selected question in terminal output", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [activeSession]}
      />,
    );

    await wait(0);
    await typeText(stdin, "l");
    await wait(0);

    const frame = lastFrame() ?? "";
    if (frame.includes("\x1B[")) {
      expect(frame).toMatch(/\x1B\[7m.*> 1\. Saved resume question\?/s);
    } else {
      expect(stripAnsi(frame)).toContain("> 1. Saved resume question?");
    }
  });

  it("renders live questions before a compact recent transcript strip", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [activeSession]}
      />,
    );

    await wait(0);
    await typeText(stdin, "l");
    await wait(0);

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame.indexOf("general questions")).toBeGreaterThan(-1);
    expect(frame.indexOf("Recent transcript")).toBeGreaterThan(-1);
    expect(frame.indexOf("general questions")).toBeLessThan(
      frame.indexOf("Recent transcript"),
    );
    expect(frame).toContain("Existing words.");
  });

  it("shows the six most recent transcript lines under live questions", async () => {
    const fake = createFakeEventSource();
    const sessionWithTranscriptHistory: InterviewSession = {
      ...activeSession,
      transcriptEvents: Array.from({ length: 7 }, (_, index) => ({
        type: "transcript",
        id: `docA:utt${index + 1}`,
        documentId: "docA",
        utteranceId: `utt${index + 1}`,
        text: `Transcript line ${index + 1}.`,
        observedAt: `2026-05-11T00:0${index}:00.000Z`,
        speaker: "candidate",
        isFinal: true,
      })),
    };
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [sessionWithTranscriptHistory]}
      />,
    );

    await wait(0);
    await typeText(stdin, "l");
    await wait(0);

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).not.toContain("Transcript line 1.");
    expect(frame).toContain("Transcript line 2.");
    expect(frame).toContain("Transcript line 7.");
  });

  it("selects, pins, and deletes individual live-session questions", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const sessionWithQuestions: InterviewSession = {
      ...activeSession,
      generalQuestions: [
        { question: "First saved question?" },
        { question: "Second saved question?", rationale: "Probe the tradeoff." },
        { question: "Third saved question?" },
      ],
    };
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [sessionWithQuestions]}
        saveInterviewSessions={saveInterviewSessions}
      />,
    );

    await wait(0);
    await typeText(stdin, "l");
    await wait(20);
    stdin.write("\x1B[B");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain("> 2. Second saved question?");

    await typeText(stdin, "p");
    await wait(20);

    expect(saveInterviewSessions).toHaveBeenLastCalledWith([
      expect.objectContaining({
        generalQuestions: [
          expect.objectContaining({ question: "First saved question?" }),
          expect.objectContaining({
            question: "Second saved question?",
            pinned: true,
          }),
          expect.objectContaining({ question: "Third saved question?" }),
        ],
      }),
    ]);
    expect(stripAnsi(lastFrame() ?? "")).toContain("[pinned] 2. Second saved question?");

    stdin.write("\x1B[3~");
    await wait(20);

    expect(saveInterviewSessions).toHaveBeenLastCalledWith([
      expect.objectContaining({
        generalQuestions: [
          expect.objectContaining({ question: "First saved question?" }),
          expect.objectContaining({ question: "Third saved question?" }),
        ],
      }),
    ]);
    expect(lastFrame()).not.toContain("Second saved question?");
  });

  it("scrolls the question panel to keep the selected question visible", async () => {
    const fake = createFakeEventSource();
    const sessionWithQuestions: InterviewSession = {
      ...activeSession,
      generalQuestions: Array.from({ length: 8 }, (_, index) => ({
        question: `Saved question ${index + 1}?`,
      })),
    };
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [sessionWithQuestions]}
      />,
    );

    await wait(0);
    await waitForExpectation(() => {
      expect(lastFrame()).toContain("l Live Interview");
    });
    await typeText(stdin, "l");
    await waitForExpectation(() => {
      expect(lastFrame()).toContain("Live Interview");
    });
    for (let count = 0; count < 6; count += 1) {
      stdin.write("\x1B[B");
      await wait(0);
    }
    await wait(20);

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("> 7. Saved question 7?");
    expect(frame).not.toContain("1. Saved question 1?");
  });

  it("starts a fresh interview from the live interview screen", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [activeSession]}
        saveInterviewSessions={saveInterviewSessions}
      />,
    );

    await wait(0);
    await typeText(stdin, "l");
    await wait(20);
    await typeText(stdin, "n");
    await wait(20);
    expect(lastFrame()).toContain("Resume: none");
    await typeText(stdin, "\r");
    await wait(20);

    expect(fake.start).toHaveBeenCalledTimes(2);
    expect(saveInterviewSessions).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: "session-active",
        status: "completed",
      }),
      expect.objectContaining({
        status: "active",
        templateId: "technical",
        transcriptEvents: [],
        generalQuestions: [],
        liveQuestions: [],
      }),
    ]);
    const savedSessions = saveInterviewSessions.mock.calls.at(-1)?.[0] as
      | InterviewSession[]
      | undefined;
    expect(savedSessions?.[1]?.resumePath).toBeUndefined();
    expect(lastFrame()).toContain("Live Interview");
    expect(lastFrame()).toContain("Waiting for new transcript changes");
    expect(lastFrame()).not.toContain("AI error:");
    expect(lastFrame()).not.toContain("Existing words.");
    expect(lastFrame()).not.toContain("Saved resume question?");
  });

  it("auto-saves transcript and live question updates to the active session", async () => {
    vi.useFakeTimers();
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const generateLiveQuestions = vi.fn().mockResolvedValue([
      {
        question: "What changed operationally?",
        rationale: "Probes design reasoning.",
        focus: "operations",
      },
    ]);
    const { stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
        generateLiveQuestions={generateLiveQuestions}
        liveQuestionOptions={{
          debounceMs: 10,
          minIntervalMs: 0,
          minNewTranscriptChars: 20,
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: {
              id: "utt1",
              text: "We introduced a durable queue to remove write bottlenecks.",
              source: "candidate",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(15);
      await Promise.resolve();
    });

    expect(generateLiveQuestions).toHaveBeenCalledOnce();
    expect(generateLiveQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeys: expect.objectContaining({
          googleGenerativeAiApiKey: "google-key",
        }),
        modelId: "google:gemini-2.5-flash",
      }),
    );
    expect(saveInterviewSessions).toHaveBeenLastCalledWith([
      expect.objectContaining({
        transcriptEvents: [
          expect.objectContaining({
            text: "We introduced a durable queue to remove write bottlenecks.",
          }),
        ],
        liveQuestions: [
          expect.objectContaining({ question: "What changed operationally?" }),
        ],
      }),
    ]);
  });

  it("force regenerates live questions from the live interview screen", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const generateLiveQuestions = vi.fn().mockResolvedValue([
      {
        question: "What new risk did the queue introduce?",
      },
    ]);
    const sessionWithTranscript: InterviewSession = {
      ...activeSession,
      generalQuestions: [
        { question: "Which resume project deserves a deeper dive?", pinned: true },
      ],
      liveQuestions: [
        { question: "What failure mode worried you most?", pinned: true },
      ],
    };
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [sessionWithTranscript]}
        saveInterviewSessions={saveInterviewSessions}
        generateLiveQuestions={generateLiveQuestions}
        liveQuestionOptions={{
          debounceMs: 1000,
          minIntervalMs: 60000,
          minNewTranscriptChars: 1000,
        }}
      />,
    );

    await waitForExpectation(() => expect(fake.start).toHaveBeenCalledOnce());
    expect(generateLiveQuestions).not.toHaveBeenCalled();

    await typeText(stdin, "r");

    await waitForExpectation(() => expect(generateLiveQuestions).toHaveBeenCalledOnce());
    expect(generateLiveQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeys: expect.objectContaining({
          googleGenerativeAiApiKey: "google-key",
        }),
        modelId: "google:gemini-2.5-flash",
        interviewType: technicalTemplate,
        transcriptText: "Existing words.",
        pinnedQuestions: [
          expect.objectContaining({
            question: "Which resume project deserves a deeper dive?",
            pinned: true,
          }),
          expect.objectContaining({
            question: "What failure mode worried you most?",
            pinned: true,
          }),
        ],
      }),
    );
    await waitForExpectation(() =>
      expect(saveInterviewSessions).toHaveBeenLastCalledWith([
        expect.objectContaining({
          liveQuestions: [
            expect.objectContaining({
              question: "What failure mode worried you most?",
              pinned: true,
            }),
            expect.objectContaining({
              question: "What new risk did the queue introduce?",
            }),
          ],
        }),
      ]),
    );
    expect(stripAnsi(lastFrame() ?? "")).toContain("r regenerate");
    expect(stripAnsi(lastFrame() ?? "")).toContain("What new risk did the queue");
  });

  it("logs transcript diffs and live question scheduling lifecycle", async () => {
    vi.useFakeTimers();
    const fake = createFakeEventSource();
    const logger = { log: vi.fn() };
    const generateLiveQuestions = vi.fn().mockResolvedValue([
      {
        question: "What changed operationally?",
      },
    ]);
    render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={vi.fn().mockResolvedValue(undefined)}
        generateLiveQuestions={generateLiveQuestions}
        logger={logger}
        liveQuestionOptions={{
          debounceMs: 10,
          minIntervalMs: 0,
          minNewTranscriptChars: 20,
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: {
              id: "utt1",
              text: "We introduced a durable queue to remove write bottlenecks.",
              source: "candidate",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(15);
      await Promise.resolve();
    });

    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "transcript.diff.received",
        sessionId: expect.stringMatching(/^session-/),
        addedCount: 1,
        updatedCount: 0,
        activeDocumentId: "docA",
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "live_generation.scheduled",
        modelId: "google:gemini-2.5-flash",
        delayMs: 10,
        transcriptChars: 58,
        newTranscriptChars: 58,
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "live_generation.started",
        modelId: "google:gemini-2.5-flash",
        requestId: expect.stringMatching(/^live-/),
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "live_generation.succeeded",
        questionCount: 1,
      }),
    );
  });

  it("logs one live question schedule for a single transcript diff", async () => {
    vi.useFakeTimers();
    const fake = createFakeEventSource();
    const logger = { log: vi.fn() };
    const generateLiveQuestions = vi.fn().mockResolvedValue([
      {
        question: "What changed operationally?",
      },
    ]);
    render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={vi.fn().mockResolvedValue(undefined)}
        generateLiveQuestions={generateLiveQuestions}
        logger={logger}
        liveQuestionOptions={{
          debounceMs: 10,
          minIntervalMs: 0,
          minNewTranscriptChars: 20,
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: {
              id: "utt1",
              text: "We introduced a durable queue to remove write bottlenecks.",
              source: "candidate",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    const scheduledLogs = logger.log.mock.calls.filter(
      ([entry]) => entry.event === "live_generation.scheduled",
    );
    expect(scheduledLogs).toHaveLength(1);
  });

  it("queues transcript growth that arrives during live question generation", async () => {
    vi.useFakeTimers();
    const fake = createFakeEventSource();
    const firstGeneration = createDeferred<InterviewQuestion[]>();
    const generateLiveQuestions = vi
      .fn()
      .mockReturnValueOnce(firstGeneration.promise)
      .mockResolvedValueOnce([
        {
          question: "What new evidence changed the design?",
        },
      ]);
    render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={vi.fn().mockResolvedValue(undefined)}
        generateLiveQuestions={generateLiveQuestions}
        liveQuestionOptions={{
          debounceMs: 10,
          minIntervalMs: 0,
          minNewTranscriptChars: 20,
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: {
              id: "utt1",
              text: "We introduced a durable queue to remove write bottlenecks.",
              source: "candidate",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(15);
      await Promise.resolve();
    });

    expect(generateLiveQuestions).toHaveBeenCalledOnce();

    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:01.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt2",
            documentId: "docA",
            utterance: {
              id: "utt2",
              text: "The candidate then tied the queue to retry isolation.",
              source: "candidate",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(generateLiveQuestions).toHaveBeenCalledOnce();

    await act(async () => {
      firstGeneration.resolve([
        {
          question: "What changed operationally?",
        },
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(15);
      await Promise.resolve();
    });

    expect(generateLiveQuestions).toHaveBeenCalledTimes(2);
    expect(generateLiveQuestions.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        transcriptText:
          "We introduced a durable queue to remove write bottlenecks.\n" +
          "The candidate then tied the queue to retry isolation.",
      }),
    );
  });

  it("excludes microphone utterances from live question generation", async () => {
    vi.useFakeTimers();
    const fake = createFakeEventSource();
    const generateLiveQuestions = vi.fn().mockResolvedValue([
      {
        question: "What constraint shaped that queue design?",
      },
    ]);
    render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={vi.fn().mockResolvedValue(undefined)}
        generateLiveQuestions={generateLiveQuestions}
        liveQuestionOptions={{
          debounceMs: 10,
          minIntervalMs: 0,
          minNewTranscriptChars: 20,
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: {
              id: "utt1",
              text: "I want to switch topics to the queue now.",
              source: "microphone",
              is_final: true,
            },
          },
          {
            key: "docA:utt2",
            documentId: "docA",
            utterance: {
              id: "utt2",
              text: "The candidate explained the queue backpressure tradeoff.",
              source: "candidate",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(15);
      await Promise.resolve();
    });

    expect(generateLiveQuestions).toHaveBeenCalledOnce();
    expect(generateLiveQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        transcriptText: "The candidate explained the queue backpressure tradeoff.",
      }),
    );
  });

  it("sends only the newest live utterances to generated question prompts", async () => {
    vi.useFakeTimers();
    const fake = createFakeEventSource();
    const generateLiveQuestions = vi.fn().mockResolvedValue([
      {
        question: "What did the newest context reveal?",
      },
    ]);
    render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={vi.fn().mockResolvedValue(undefined)}
        generateLiveQuestions={generateLiveQuestions}
        liveQuestionOptions={{
          debounceMs: 10,
          minIntervalMs: 0,
          minNewTranscriptChars: 20,
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: Array.from({ length: 14 }, (_, index) => {
          const utteranceNumber = index + 1;
          return {
            key: `docA:utt${utteranceNumber}`,
            documentId: "docA",
            utterance: {
              id: `utt${utteranceNumber}`,
              text: `Candidate answer ${utteranceNumber.toString().padStart(2, "0")}`,
              source: "candidate",
              is_final: true,
            },
          };
        }),
        updated: [],
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(15);
      await Promise.resolve();
    });

    expect(generateLiveQuestions).toHaveBeenCalledOnce();
    const promptText = generateLiveQuestions.mock.calls[0]?.[0]?.transcriptText;
    expect(promptText).toBe(
      Array.from(
        { length: 12 },
        (_, index) => `Candidate answer ${(index + 3).toString().padStart(2, "0")}`,
      ).join("\n"),
    );
    expect(promptText).not.toContain("Candidate answer 01");
    expect(promptText).not.toContain("Candidate answer 02");
  });

  it("keeps pinned live questions first and filters generated duplicates on refresh", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const sessionWithPinnedContext: InterviewSession = {
      ...activeSession,
      generalQuestions: [
        { question: "Which resume project deserves a deeper dive?", pinned: true },
      ],
      liveQuestions: [{ question: "What failure mode worried you most?" }],
    };
    const generateLiveQuestions = vi.fn().mockResolvedValue([
      {
        question: "What failure mode worried you most?",
        rationale: "Duplicate of the pinned question.",
        focus: "resilience",
      },
      {
        question: "What new risk did the queue introduce?",
        rationale: "Complements the latest transcript.",
        focus: "tradeoffs",
      },
    ]);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [sessionWithPinnedContext]}
        saveInterviewSessions={saveInterviewSessions}
        generateLiveQuestions={generateLiveQuestions}
        liveQuestionOptions={{
          debounceMs: 10,
          minIntervalMs: 0,
          minNewTranscriptChars: 20,
        }}
      />,
    );

    await wait(0);
    await typeText(stdin, "llp");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain("[pinned] 1. What failure mode");
    expect(stripAnsi(lastFrame() ?? "")).toContain("worried you most?");

    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt1-refresh",
            documentId: "docA",
            utterance: {
              id: "utt1-refresh",
              text: "We introduced a durable queue to remove write bottlenecks.",
              source: "candidate",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });

    await waitForExpectation(() => expect(generateLiveQuestions).toHaveBeenCalledOnce());
    expect(generateLiveQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        pinnedQuestions: [
          expect.objectContaining({
            question: "Which resume project deserves a deeper dive?",
            pinned: true,
          }),
          expect.objectContaining({
            question: "What failure mode worried you most?",
            pinned: true,
          }),
        ],
      }),
    );

    await waitForExpectation(() =>
      expect(saveInterviewSessions).toHaveBeenLastCalledWith([
        expect.objectContaining({
          liveQuestions: [
            expect.objectContaining({
              question: "What failure mode worried you most?",
              pinned: true,
            }),
            expect.objectContaining({
              question: "What new risk did the queue introduce?",
            }),
          ],
        }),
      ]),
    );
    expect(stripAnsi(lastFrame() ?? "")).toContain("[pinned] 1. What failure mode");
    expect(stripAnsi(lastFrame() ?? "")).toContain("worried you most?");
    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "2. What new risk did the queue",
    );
    expect(stripAnsi(lastFrame() ?? "")).toContain("introduce?");

    const savedSessions = saveInterviewSessions.mock.calls.at(-1)?.[0] as
      | InterviewSession[]
      | undefined;
    expect(
      savedSessions?.[0]?.liveQuestions.filter(
        (question) => question.question === "What failure mode worried you most?",
      ),
    ).toHaveLength(1);
  });

  it("keeps successive live transcript diffs in the visible session", async () => {
    const fake = createFakeEventSource();
    const { lastFrame } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitForExpectation(() => expect(fake.start).toHaveBeenCalledOnce());
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: { id: "utt1", text: "First answer.", source: "candidate" },
          },
        ],
        updated: [],
      });
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:01.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt2",
            documentId: "docA",
            utterance: { id: "utt2", text: "Second answer.", source: "candidate" },
          },
        ],
        updated: [],
      });
    });

    expect(lastFrame()).toContain("First answer.");
    expect(lastFrame()).toContain("Second answer.");
  });

  it("renders simulation-source transcript events and persists them to the active session", async () => {
    const fake = createFakeEventSource();
    const saveInterviewSessions = vi.fn().mockResolvedValue(undefined);
    const { lastFrame } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={saveInterviewSessions}
      />,
    );

    await waitForExpectation(() => expect(fake.start).toHaveBeenCalledOnce());
    act(() => {
      fake.callbacks.started?.({
        type: "watch_started",
        granolaDir: "simulation://sim-demo",
        intervalMs: 0,
        transcriptDocuments: 1,
        activeDocumentId: "sim-demo",
      });
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "sim-demo",
        added: [
          {
            key: "sim-demo:sim-demo-0000-1",
            documentId: "sim-demo",
            utterance: {
              id: "sim-demo-0000-1",
              text: "Tell me about the queueing design.",
              source: "Interviewer",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });

    expect(lastFrame()).toContain("simulation://sim-demo");
    expect(lastFrame()).toContain("Tell me about the queueing design.");
    expect(saveInterviewSessions).toHaveBeenLastCalledWith([
      expect.objectContaining({
        transcriptEvents: [
          expect.objectContaining({
            documentId: "sim-demo",
            text: "Tell me about the queueing design.",
            speaker: "Interviewer",
          }),
        ],
      }),
    ]);
  });

  it("opens Settings to a section picker and navigates into sections", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "s");
    await wait(20);

    let frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Settings");
    expect(frame).toContain("j/k section · enter open · esc dashboard");
    expect(frame).toContain("> API Keys");
    expect(frame).toContain("Prompt Defaults");
    expect(frame).toContain("Interview Templates");
    expect(frame).not.toContain("c blank · u use default");

    stdin.write("\x1B[B");
    await wait(20);
    await typeText(stdin, "\r");
    await wait(20);

    frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Settings / Prompt Defaults");
    expect(frame).toContain("j/k default · enter use as draft · esc settings");

    stdin.write("\x1B[B");
    await wait(20);

    frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("> Full Stack Platform Engineer");

    await typeText(stdin, "\x1B\x1B");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain("Dashboard");
  });

  it("navigates Settings API keys with arrow keys", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "s\r");
    await wait(20);

    stdin.write("\x1B[B");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain("> Google API key");
  });

  it("navigates Settings templates with arrow keys", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate, systemDesignTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "s");
    await wait(20);
    stdin.write("\x1B[B");
    await wait(20);
    stdin.write("\x1B[B");
    await wait(20);
    await typeText(stdin, "\r");
    await wait(20);

    stdin.write("\x1B[B");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain("> System Design Interview");
  });

  it("creates and edits templates in Settings", async () => {
    const fake = createFakeEventSource();
    const saveInterviewTypes = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => []}
        saveInterviewTypes={saveInterviewTypes}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(
      stdin,
      "sjj\rcTechnical Interview\tAssess technical depth\tdebugging, architecture\tsystems, behavioral\r",
    );
    await wait(20);
    expect(saveInterviewTypes).toHaveBeenLastCalledWith([
      expect.objectContaining({
        name: "Technical Interview",
        systemPrompt: "Assess technical depth",
      }),
    ]);

    await typeText(stdin, "\r - senior\r");
    await wait(20);

    expect(saveInterviewTypes).toHaveBeenLastCalledWith([
      expect.objectContaining({
        name: "Technical Interview - senior",
      }),
    ]);
    expect(lastFrame()).toContain("Technical Interview - senior");
  });

  it("shows full-stack prompt defaults in Settings and cycles the preview", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "sj\r");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain("Settings / Prompt Defaults");
    expect(stripAnsi(lastFrame() ?? "")).toContain("Full Stack Product Engineer");

    await typeText(stdin, "j");
    await wait(20);

    expect(stripAnsi(lastFrame() ?? "")).toContain("Full Stack Platform Engineer");
  });

  it("creates a new template draft from the selected full-stack default", async () => {
    const fake = createFakeEventSource();
    const saveInterviewTypes = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => []}
        saveInterviewTypes={saveInterviewTypes}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "sj\r\r");
    await wait(20);

    expect(saveInterviewTypes).not.toHaveBeenCalled();
    expect(stripAnsi(lastFrame() ?? "")).toContain("New template · name");
    expect(stripAnsi(lastFrame() ?? "")).toContain("Full Stack Product Engineer");
    expect(stripAnsi(lastFrame() ?? "")).toContain("product judgment");

    await typeText(stdin, "\r");
    await wait(20);

    expect(saveInterviewTypes).toHaveBeenLastCalledWith([
      expect.objectContaining({
        name: "Full Stack Product Engineer",
        systemPrompt: expect.stringContaining("full-stack product engineering interviewer"),
        qualities: expect.arrayContaining(["product judgment", "frontend craft"]),
        questionTypes: expect.arrayContaining(["resume deep dive", "system design"]),
      }),
    ]);
    expect(stripAnsi(lastFrame() ?? "")).toContain("Settings / Interview Templates");
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("Settings / Prompt Defaults");
  });

  it("saves API keys from Settings", async () => {
    const fake = createFakeEventSource();
    const saveAppSettings = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadAppSettings={async () => ({
          apiKeys: {
            openaiApiKey: "",
            googleGenerativeAiApiKey: "",
            anthropicApiKey: "",
            anthropicAuthToken: "",
          },
        })}
        saveAppSettings={saveAppSettings}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "s\r\rgranola-openai-key\r");
    await wait(20);

    expect(saveAppSettings).toHaveBeenCalledWith({
      selectedPdfModelId: "openai:gpt-5",
      selectedLiveModelId: "google:gemini-2.5-flash",
      apiKeys: {
        openaiApiKey: "granola-openai-key",
        googleGenerativeAiApiKey: "",
        anthropicApiKey: "",
        anthropicAuthToken: "",
      },
    });
    expect(stripAnsi(lastFrame() ?? "")).toContain("OpenAI API key");
    expect(stripAnsi(lastFrame() ?? "")).toContain("set");
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("granola-openai-key");
  });

  it("shows available model choices and grays out families with missing API keys", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadAppSettings={async () => ({
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
          apiKeys: {
            openaiApiKey: "openai-key",
            googleGenerativeAiApiKey: "",
            anthropicApiKey: "",
            anthropicAuthToken: "anthropic-token",
          },
        })}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "s\r");
    await wait(20);

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("PDF model");
    expect(frame).toContain("Live model");
    expect(frame).toContain("> GPT-5 · available");
    expect(frame).toContain("> Gemini 2.5 Flash · missing Google Generative AI API key");
    expect(frame).toContain("Gemini 2.5 Flash · missing Google Generative AI API key");
    expect(frame).toContain("Claude Sonnet 4.6 · available");
  });

  it("saves the next available PDF model from Settings and uses it for resume questions", async () => {
    const fake = createFakeEventSource();
    const saveAppSettings = vi.fn().mockResolvedValue(undefined);
    const generateResumeQuestions = vi.fn().mockResolvedValue([]);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadAppSettings={async () => ({
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
          apiKeys: {
            openaiApiKey: "openai-key",
            googleGenerativeAiApiKey: "",
            anthropicApiKey: "",
            anthropicAuthToken: "anthropic-token",
          },
        })}
        saveAppSettings={saveAppSettings}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        chooseResumeFile={async () => "/tmp/picked.pdf"}
        generateResumeQuestions={generateResumeQuestions}
      />,
    );

    await wait(0);
    await typeText(stdin, "s\rp");
    await wait(20);

    expect(saveAppSettings).toHaveBeenCalledWith({
      selectedPdfModelId: "anthropic:claude-sonnet-4-6",
      selectedLiveModelId: "google:gemini-2.5-flash",
      apiKeys: {
        openaiApiKey: "openai-key",
        googleGenerativeAiApiKey: "",
        anthropicApiKey: "",
        anthropicAuthToken: "anthropic-token",
      },
    });
    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "> Claude Sonnet 4.6 · available",
    );

    await typeText(stdin, "\x1B\x1Bnr\r");
    await wait(20);

    expect(generateResumeQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "anthropic:claude-sonnet-4-6",
      }),
    );
  });

  it("saves the next available live model from Settings and uses it for live questions", async () => {
    const fake = createFakeEventSource();
    const saveAppSettings = vi.fn().mockResolvedValue(undefined);
    const generateLiveQuestions = vi.fn().mockResolvedValue([]);
    const { stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        initialInterviewTypeId="technical"
        loadAppSettings={async () => ({
          selectedPdfModelId: "openai:gpt-5",
          selectedLiveModelId: "google:gemini-2.5-flash",
          apiKeys: {
            openaiApiKey: "openai-key",
            googleGenerativeAiApiKey: "google-key",
            anthropicApiKey: "",
            anthropicAuthToken: "anthropic-token",
          },
        })}
        saveAppSettings={saveAppSettings}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => []}
        saveInterviewSessions={vi.fn().mockResolvedValue(undefined)}
        generateLiveQuestions={generateLiveQuestions}
        liveQuestionOptions={{
          debounceMs: 10,
          minIntervalMs: 0,
          minNewTranscriptChars: 20,
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    await typeText(stdin, "\x1Bs\rm");
    await wait(20);

    expect(saveAppSettings).toHaveBeenCalledWith({
      selectedPdfModelId: "openai:gpt-5",
      selectedLiveModelId: "anthropic:claude-sonnet-4-6",
      apiKeys: {
        openaiApiKey: "openai-key",
        googleGenerativeAiApiKey: "google-key",
        anthropicApiKey: "",
        anthropicAuthToken: "anthropic-token",
      },
    });

    await typeText(stdin, "\x1B\x1Bl");
    await wait(20);

    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        activeDocumentId: "docA",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: {
              id: "utt1",
              text: "We introduced a durable queue to remove write bottlenecks.",
              source: "candidate",
              is_final: true,
            },
          },
        ],
        updated: [],
      });
    });
    await wait(20);

    expect(generateLiveQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "anthropic:claude-sonnet-4-6",
      }),
    );
  });

  it("does not save a blank template and exits the editor with escape", async () => {
    const fake = createFakeEventSource();
    const saveInterviewTypes = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => []}
        saveInterviewTypes={saveInterviewTypes}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "sjj\rc\r");
    await wait(20);
    expect(saveInterviewTypes).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("AI error: Template name is required");

    await typeText(stdin, "\x1B");
    await wait(20);
    expect(lastFrame()).toContain("Settings");
    expect(lastFrame()).not.toContain("New template");
  });

  it("renders the active system prompt editor as a multi-line area", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => []}
        loadInterviewSessions={async () => []}
      />,
    );

    await wait(0);
    await typeText(stdin, "sjj\rc\t");
    await wait(20);

    const lines = stripAnsi(lastFrame() ?? "").split("\n");
    const systemPromptLine = lines.findIndex((line) => line.includes("System prompt:"));
    const qualitiesLine = lines.findIndex(
      (line, index) => index > systemPromptLine && line.includes("Qualities:"),
    );

    expect(systemPromptLine).toBeGreaterThanOrEqual(0);
    expect(qualitiesLine - systemPromptLine).toBeGreaterThanOrEqual(5);
  });

  it("blocks deleting templates referenced by saved sessions", async () => {
    const fake = createFakeEventSource();
    const saveInterviewTypes = vi.fn().mockResolvedValue(undefined);
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        saveInterviewTypes={saveInterviewTypes}
        loadInterviewSessions={async () => [completedSession]}
      />,
    );

    await wait(0);
    await typeText(stdin, "sjj\rd");
    await wait(20);

    expect(saveInterviewTypes).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("Cannot delete a template with saved interviews");
  });

  it("shows past interviews newest first and reviews saved questions without regeneration", async () => {
    const fake = createFakeEventSource();
    const generateLiveQuestions = vi.fn();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [completedSession, olderCompletedSession]}
        generateLiveQuestions={generateLiveQuestions}
      />,
    );

    await wait(0);
    await typeText(stdin, "p\r");
    await wait(0);

    expect(lastFrame()).toContain("Past Interview");
    expect(lastFrame()).toContain("A newer transcript.");
    expect(lastFrame()).toContain("Saved live question?");
    expect(generateLiveQuestions).not.toHaveBeenCalled();
  });

  it("copies a Granola analysis prompt for the live interview", async () => {
    const fake = createFakeEventSource();
    const copyTextToClipboard = vi.fn();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [activeSession]}
        copyTextToClipboard={copyTextToClipboard}
      />,
    );

    await wait(0);
    await typeText(stdin, "la");
    await wait(20);

    expect(copyTextToClipboard).toHaveBeenCalledOnce();
    const copiedPrompt = copyTextToClipboard.mock.calls[0]?.[0] as string;
    expect(copiedPrompt).toContain("Review this interview");
    expect(copiedPrompt).toContain("Existing words.");
    expect(copiedPrompt).toContain("Saved resume question?");
    expect(lastFrame()).toContain("Granola analysis prompt copied.");
  });

  it("copies a Granola analysis prompt for a past interview", async () => {
    const fake = createFakeEventSource();
    const copyTextToClipboard = vi.fn();
    const { lastFrame, stdin } = render(
      <ChatApp
        createEventSource={fake.createEventSource}
        loadInterviewTypes={async () => [technicalTemplate]}
        loadInterviewSessions={async () => [completedSession]}
        copyTextToClipboard={copyTextToClipboard}
      />,
    );

    await wait(0);
    await typeText(stdin, "p\ra");
    await wait(20);

    expect(copyTextToClipboard).toHaveBeenCalledOnce();
    const copiedPrompt = copyTextToClipboard.mock.calls[0]?.[0] as string;
    expect(copiedPrompt).toContain("A newer transcript.");
    expect(copiedPrompt).toContain("Saved resume question?");
    expect(copiedPrompt).toContain("Saved live question?");
    expect(lastFrame()).toContain("Granola analysis prompt copied.");
  });
});

const technicalTemplate: InterviewType = {
  id: "technical",
  name: "Technical Interview",
  systemPrompt: "Assess technical depth.",
  qualities: ["debugging", "architecture"],
  questionTypes: ["systems", "behavioral"],
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:00:00.000Z",
};

const systemDesignTemplate: InterviewType = {
  id: "system-design",
  name: "System Design Interview",
  systemPrompt: "Assess system design judgment.",
  qualities: ["scalability", "tradeoffs"],
  questionTypes: ["architecture", "operations"],
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:00:00.000Z",
};

const activeSession: InterviewSession = {
  id: "session-active",
  status: "active",
  templateId: "technical",
  templateSnapshot: technicalTemplate,
  resumePath: "/tmp/resume.pdf",
  transcriptEvents: [
    {
      type: "transcript",
      id: "docA:utt1",
      documentId: "docA",
      utteranceId: "utt1",
      text: "Existing words.",
      observedAt: "2026-05-11T00:01:00.000Z",
      isFinal: true,
    },
  ],
  generalQuestions: [{ question: "Saved resume question?" }],
  liveQuestions: [],
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:01:00.000Z",
};

const completedSession: InterviewSession = {
  ...activeSession,
  id: "session-newer",
  status: "completed",
  transcriptEvents: [
    {
      type: "transcript",
      id: "docA:utt2",
      documentId: "docA",
      utteranceId: "utt2",
      text: "A newer transcript.",
      observedAt: "2026-05-11T00:03:00.000Z",
      isFinal: true,
    },
  ],
  liveQuestions: [{ question: "Saved live question?" }],
  createdAt: "2026-05-11T00:03:00.000Z",
  updatedAt: "2026-05-11T00:04:00.000Z",
  completedAt: "2026-05-11T00:04:00.000Z",
};

const olderCompletedSession: InterviewSession = {
  ...completedSession,
  id: "session-older",
  transcriptEvents: [
    {
      type: "transcript",
      id: "docA:utt3",
      documentId: "docA",
      utteranceId: "utt3",
      text: "An older transcript.",
      observedAt: "2026-05-10T00:03:00.000Z",
      isFinal: true,
    },
  ],
  createdAt: "2026-05-10T00:03:00.000Z",
  updatedAt: "2026-05-10T00:04:00.000Z",
  completedAt: "2026-05-10T00:04:00.000Z",
};

function createFakeEventSource() {
  const start = vi.fn();
  const stop = vi.fn();
  let callbacks: GranolaEventSourceCallbacks | null = null;

  return {
    start,
    stop,
    get callbacks() {
      if (!callbacks) {
        throw new Error("event source was not created");
      }
      return callbacks;
    },
    createEventSource(nextCallbacks: GranolaEventSourceCallbacks): GranolaEventSource {
      callbacks = nextCallbacks;
      return { start, stop };
    },
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeText(stdin: { write: (value: string) => void }, value: string) {
  for (const character of value) {
    stdin.write(character);
    await wait(0);
  }
}

async function flushEffects(times: number) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function waitForExpectation(assertion: () => void, timeoutMs = 1000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await wait(10);
    }
  }

  throw lastError;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}
