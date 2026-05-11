import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_APP_SETTINGS,
  getAppSettingsFilePath,
  loadAppSettings,
  saveAppSettings,
  validateAppSettings,
} from "../src/config/app-settings.js";

describe("app settings persistence", () => {
  it("uses the macOS Application Support location", () => {
    expect(
      getAppSettingsFilePath({
        platform: "darwin",
        homeDir: "/Users/tester",
        env: {},
      }),
    ).toBe(
      "/Users/tester/Library/Application Support/interviewer-cue/app-settings.json",
    );
  });

  it("uses XDG config on non-macOS platforms", () => {
    expect(
      getAppSettingsFilePath({
        platform: "linux",
        homeDir: "/home/tester",
        env: { XDG_CONFIG_HOME: "/tmp/config" },
      }),
    ).toBe("/tmp/config/interviewer-cue/app-settings.json");
  });

  it("returns empty key settings when no settings file exists", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "interviewer-cue-"));

    await expect(loadAppSettings(path.join(dir, "missing.json"))).resolves.toEqual(
      DEFAULT_APP_SETTINGS,
    );
  });

  it("defaults the selected model when loading older settings files", () => {
    expect(validateAppSettings({ apiKeys: {} })).toEqual({
      apiKeys: {
        openaiApiKey: "",
        googleGenerativeAiApiKey: "",
        anthropicApiKey: "",
        anthropicAuthToken: "",
      },
      selectedPdfModelId: "openai:gpt-5",
      selectedLiveModelId: "google:gemini-2.5-flash",
    });
  });

  it("migrates the old single selected model to the PDF model only", () => {
    expect(
      validateAppSettings({
        apiKeys: {},
        selectedModelId: "anthropic:claude-sonnet-4-6",
      }),
    ).toEqual({
      apiKeys: {
        openaiApiKey: "",
        googleGenerativeAiApiKey: "",
        anthropicApiKey: "",
        anthropicAuthToken: "",
      },
      selectedPdfModelId: "anthropic:claude-sonnet-4-6",
      selectedLiveModelId: "google:gemini-2.5-flash",
    });
  });

  it("round-trips API key settings through JSON", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "interviewer-cue-"));
    const filePath = path.join(dir, "nested", "app-settings.json");
    const settings = validateAppSettings({
      selectedPdfModelId: "anthropic:claude-sonnet-4-6",
      selectedLiveModelId: "google:gemini-2.5-flash",
      apiKeys: {
        openaiApiKey: "openai-key",
        googleGenerativeAiApiKey: "google-key",
        anthropicApiKey: "anthropic-key",
        anthropicAuthToken: "anthropic-token",
      },
    });

    await saveAppSettings(settings, filePath);

    await expect(loadAppSettings(filePath)).resolves.toEqual(settings);
  });
});
