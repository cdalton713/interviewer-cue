import type { ApiKeySettings } from "../config/app-settings.js";

export type AppMode = "dashboard" | "new" | "live" | "past" | "pastDetail" | "settings";
export type QuestionPanelMode = "general" | "live";
export type AiStatus = "idle" | "loading" | "error";
export type SettingsSection = "index" | "apiKeys" | "promptDefaults" | "templates";

export interface DraftInterviewType {
  name: string;
  systemPrompt: string;
  qualities: string;
  questionTypes: string;
}

export type ApiKeyField = keyof ApiKeySettings;

export type EditorState =
  | { mode: "none" }
  | { mode: "new" | "edit"; fieldIndex: number; draft: DraftInterviewType }
  | { mode: "candidateName"; value: string }
  | { mode: "apiKey"; field: ApiKeyField; value: string };
