import type { ApiKeyField, SettingsSection } from "./chat-app-types.js";

export const AI_LOADING_SPINNER_FRAMES = ["-", "\\", "|", "/"] as const;
export const AI_LOADING_SPINNER_INTERVAL_MS = 120;
export const MAX_VISIBLE_QUESTIONS = 3;
export const RECENT_TRANSCRIPT_LINES = 6;

export const uiColor = {
  app: "cyan",
  interviewer: "magenta",
  candidate: "green",
  selected: "cyan",
  pinned: "yellow",
  editing: "yellow",
  healthy: "green",
  muted: "gray",
  danger: "red",
  body: "white",
} as const;

export const editorFields = ["name", "systemPrompt", "qualities", "questionTypes"] as const;

export const settingsSections: Array<{
  section: Exclude<SettingsSection, "index">;
  label: string;
}> = [
  { section: "apiKeys", label: "API Keys" },
  { section: "promptDefaults", label: "Prompt Defaults" },
  { section: "templates", label: "Interview Templates" },
];

export const apiKeyFields: Array<{ field: ApiKeyField; label: string; command: string }> = [
  { field: "openaiApiKey", label: "OpenAI API key", command: "o" },
  {
    field: "googleGenerativeAiApiKey",
    label: "Google API key",
    command: "g",
  },
  { field: "anthropicApiKey", label: "Anthropic API key", command: "a" },
  { field: "anthropicAuthToken", label: "Anthropic auth token", command: "t" },
];
