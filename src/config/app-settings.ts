import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { z } from "zod";

export interface ApiKeySettings {
  openaiApiKey: string;
  googleGenerativeAiApiKey: string;
  anthropicApiKey: string;
  anthropicAuthToken: string;
}

export const DEFAULT_PDF_MODEL_ID = "openai:gpt-5";
export const DEFAULT_LIVE_MODEL_ID = "google:gemini-2.5-flash";
export const DEFAULT_SELECTED_MODEL_ID = DEFAULT_PDF_MODEL_ID;

export const DEFAULT_API_KEY_SETTINGS: ApiKeySettings = {
  openaiApiKey: "",
  googleGenerativeAiApiKey: "",
  anthropicApiKey: "",
  anthropicAuthToken: "",
};

export const apiKeySettingsSchema = z.object({
  openaiApiKey: z.string().default(""),
  googleGenerativeAiApiKey: z.string().default(""),
  anthropicApiKey: z.string().default(""),
  anthropicAuthToken: z.string().default(""),
});

const rawAppSettingsSchema = z.object({
  apiKeys: apiKeySettingsSchema.default(DEFAULT_API_KEY_SETTINGS),
  selectedModelId: z.string().optional(),
  selectedPdfModelId: z.string().optional(),
  selectedLiveModelId: z.string().optional(),
});

export const appSettingsSchema = rawAppSettingsSchema.transform((settings) => ({
  apiKeys: settings.apiKeys,
  selectedPdfModelId:
    settings.selectedPdfModelId ??
    settings.selectedModelId ??
    DEFAULT_PDF_MODEL_ID,
  selectedLiveModelId: settings.selectedLiveModelId ?? DEFAULT_LIVE_MODEL_ID,
}));

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  apiKeys: DEFAULT_API_KEY_SETTINGS,
  selectedPdfModelId: DEFAULT_PDF_MODEL_ID,
  selectedLiveModelId: DEFAULT_LIVE_MODEL_ID,
};

export interface AppSettingsPathOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

export function getAppSettingsFilePath(
  options: AppSettingsPathOptions = {},
): string {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const env = options.env ?? process.env;

  if (platform === "darwin") {
    return path.join(
      homeDir,
      "Library",
      "Application Support",
      "interviewer-cue",
      "app-settings.json",
    );
  }

  return path.join(
    env.XDG_CONFIG_HOME ?? path.join(homeDir, ".config"),
    "interviewer-cue",
    "app-settings.json",
  );
}

export function validateAppSettings(value: unknown): AppSettings {
  const result = appSettingsSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid app settings file: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export async function loadAppSettings(
  filePath = getAppSettingsFilePath(),
): Promise<AppSettings> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return DEFAULT_APP_SETTINGS;
    throw error;
  }

  return validateAppSettings(JSON.parse(raw) as unknown);
}

export async function saveAppSettings(
  appSettings: AppSettings,
  filePath = getAppSettingsFilePath(),
): Promise<void> {
  const validated = validateAppSettings(appSettings);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
