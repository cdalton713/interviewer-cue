import { describe, expect, it } from "vitest";

import { parseSimulationScenario } from "../src/simulation/scenario.js";

describe("parseSimulationScenario", () => {
  it("parses markdown hunks, speaker lines, document id, and timestamps", () => {
    const scenario = parseSimulationScenario(`
# Technical Interview Demo
@document sim-demo

## 00:00
Interviewer: Tell me about the queueing design.
Candidate: We introduced a durable queue.

## 00:30
Candidate: The worker pool drains jobs with retries.
`);

    expect(scenario.title).toBe("Technical Interview Demo");
    expect(scenario.documentId).toBe("sim-demo");
    expect(scenario.hunks).toHaveLength(2);
    expect(scenario.hunks[0]).toMatchObject({
      label: "00:00",
      startSeconds: 0,
      utterances: [
        {
          id: "sim-demo-0000-1",
          source: "Interviewer",
          text: "Tell me about the queueing design.",
          start_timestamp: "0",
          end_timestamp: "0",
          is_final: true,
        },
        {
          id: "sim-demo-0000-2",
          source: "Candidate",
          text: "We introduced a durable queue.",
          start_timestamp: "0",
          end_timestamp: "0",
          is_final: true,
        },
      ],
    });
    expect(scenario.hunks[1]?.utterances[0]).toMatchObject({
      id: "sim-demo-0030-1",
      start_timestamp: "30",
      end_timestamp: "30",
    });
  });

  it("parses explicit utterance id and final annotations", () => {
    const scenario = parseSimulationScenario(`
# Demo

## 01:00
Candidate [id=answer-3 final=false]: We watched queue depth and lag...
Candidate [id=answer-3 final=true]: We watched queue depth, processing lag, and retry rates.
`);

    expect(scenario.documentId).toBe("simulation");
    expect(scenario.hunks[0]?.utterances).toEqual([
      {
        id: "answer-3",
        source: "Candidate",
        text: "We watched queue depth and lag...",
        start_timestamp: "60",
        end_timestamp: "60",
        is_final: false,
      },
      {
        id: "answer-3",
        source: "Candidate",
        text: "We watched queue depth, processing lag, and retry rates.",
        start_timestamp: "60",
        end_timestamp: "60",
        is_final: true,
      },
    ]);
  });
});
