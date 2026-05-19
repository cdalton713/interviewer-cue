import type { GranolaTranscriptUtterance } from "../granola/types.js";

export interface SimulationScenario {
  title: string;
  documentId: string;
  hunks: SimulationScenarioHunk[];
}

export interface SimulationScenarioHunk {
  label: string;
  startSeconds: number;
  utterances: GranolaTranscriptUtterance[];
}
