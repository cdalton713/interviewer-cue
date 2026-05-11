import React from "react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";

import type {
  GranolaEventSource,
  GranolaEventSourceCallbacks,
} from "../src/granola/event-source.js";
import { ChatApp } from "../src/ui/ChatApp.js";

describe("ChatApp", () => {
  it("renders the live transcript console empty state", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, unmount } = render(
      <ChatApp createEventSource={fake.createEventSource} />,
    );

    await wait(0);

    expect(fake.start).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain("Granola Transcript Console");
    expect(lastFrame()).toContain("Waiting for new transcript changes");
    expect(lastFrame()).toContain("status watching");
    expect(lastFrame()).toContain("lines 0");
    expect(lastFrame()).not.toContain("mode mock");
    expect(lastFrame()).not.toContain("Ask about the current interview");

    unmount();
    await wait(0);
    expect(fake.stop).toHaveBeenCalledOnce();
  });

  it("appends new transcript events from the source", async () => {
    const fake = createFakeEventSource();
    const { lastFrame } = render(
      <ChatApp createEventSource={fake.createEventSource} />,
    );

    await wait(0);
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: { id: "utt1", text: "We should ship it.", source: "person" },
          },
        ],
        updated: [],
      });
    });

    expect(lastFrame()).toContain("person");
    expect(lastFrame()).toContain("We should ship it.");
    expect(lastFrame()).toContain("lines 1");
  });

  it("updates an existing utterance line by stable id", async () => {
    const fake = createFakeEventSource();
    const { lastFrame } = render(
      <ChatApp createEventSource={fake.createEventSource} />,
    );

    await wait(0);
    act(() => {
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:00.000Z",
        added: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: { id: "utt1", text: "hel", source: "person" },
          },
        ],
        updated: [],
      });
      fake.callbacks.transcriptDiff?.({
        type: "transcript_diff",
        observedAt: "2026-05-11T12:00:01.000Z",
        added: [],
        updated: [
          {
            key: "docA:utt1",
            documentId: "docA",
            utterance: { id: "utt1", text: "hello", source: "person" },
            previous: { id: "utt1", text: "hel", source: "person" },
          },
        ],
      });
    });

    expect(lastFrame()).toContain("hello");
    expect(lastFrame()).not.toContain("hel\n");
    expect(lastFrame()).toContain("lines 1");
  });

  it("does not render a prompt or fabricate mock assistant responses", async () => {
    const fake = createFakeEventSource();
    const { lastFrame, stdin } = render(
      <ChatApp createEventSource={fake.createEventSource} />,
    );

    await wait(0);
    stdin.write("What changed?");
    stdin.write("\r");
    await wait(10);

    expect(lastFrame()).not.toContain("What changed?");
    expect(lastFrame()).not.toContain("Assistant");
    expect(lastFrame()).not.toContain("Mock response");
    expect(lastFrame()).not.toContain("›");
  });
});

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
