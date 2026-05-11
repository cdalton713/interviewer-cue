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

export function parseSimulationScenario(markdown: string): SimulationScenario {
  const lines = markdown.split(/\r?\n/);
  const title =
    lines.find((line) => line.trim().startsWith("# "))?.replace(/^#\s+/, "").trim() ??
    "Simulation";
  const documentId =
    lines
      .map((line) => line.trim())
      .find((line) => line.startsWith("@document "))
      ?.replace(/^@document\s+/, "")
      .trim() || "simulation";

  const hunks: SimulationScenarioHunk[] = [];
  let current: SimulationScenarioHunk | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const hunkMatch = /^##\s+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)$/.exec(line);
    if (hunkMatch) {
      const label = hunkMatch[1] ?? "00:00";
      current = {
        label,
        startSeconds: parseScenarioTimestamp(label),
        utterances: [],
      };
      hunks.push(current);
      continue;
    }

    if (!current) continue;

    const utterance = parseSpeakerLine(
      line,
      documentId,
      current.label,
      current.startSeconds,
      current.utterances.length + 1,
    );
    if (utterance) {
      current.utterances.push(utterance);
    }
  }

  return { title, documentId, hunks };
}

function parseSpeakerLine(
  line: string,
  documentId: string,
  hunkLabel: string,
  startSeconds: number,
  lineNumber: number,
): GranolaTranscriptUtterance | null {
  const match = /^([^:[\]]+?)(?:\s+\[([^\]]+)])?:\s*(.+)$/.exec(line);
  if (!match) return null;

  const source = match[1]?.trim() ?? "Speaker";
  const annotations = parseAnnotations(match[2] ?? "");
  const id = annotations.id ?? `${documentId}-${formatHunkId(hunkLabel)}-${lineNumber}`;
  const isFinal =
    annotations.final === undefined ? true : annotations.final.toLowerCase() === "true";

  return {
    id,
    source,
    text: match[3]?.trim() ?? "",
    start_timestamp: String(startSeconds),
    end_timestamp: String(startSeconds),
    is_final: isFinal,
  };
}

function parseAnnotations(value: string): Record<string, string> {
  return Object.fromEntries(
    value
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key, rest.join("=")];
      })
      .filter(([key, parsedValue]) => key && parsedValue !== ""),
  );
}

function parseScenarioTimestamp(value: string): number {
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Invalid scenario timestamp: ${value}`);
  }

  if (parts.length === 2) {
    const [minutes = 0, seconds = 0] = parts;
    return minutes * 60 + seconds;
  }

  const [hours = 0, minutes = 0, seconds = 0] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatHunkId(label: string): string {
  return label.replaceAll(":", "").padStart(4, "0");
}
