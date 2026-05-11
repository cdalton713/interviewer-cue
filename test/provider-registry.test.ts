import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODEL_ID,
  DEFAULT_API_KEY_SETTINGS,
  DEFAULT_LIVE_MODEL_ID,
  DEFAULT_PDF_MODEL_ID,
  SUPPORTED_MODEL_OPTIONS,
  createProviderRegistryOptions,
  getAvailableModelOptions,
  isModelOptionAvailable,
  parseModelId,
  resolveLanguageModel,
} from "../src/ai/provider-registry.js";

describe("provider registry", () => {
  it("resolves direct OpenAI, Google, and Anthropic provider model ids", () => {
    expect(resolveLanguageModel("openai:gpt-5").modelId).toBe("gpt-5");
    expect(resolveLanguageModel("google:gemini-2.5-flash").modelId).toBe(
      "gemini-2.5-flash",
    );
    expect(resolveLanguageModel("anthropic:claude-sonnet-4-5").modelId).toBe(
      "claude-sonnet-4-5",
    );
  });

  it("defaults to openai:gpt-5", () => {
    expect(DEFAULT_MODEL_ID).toBe("openai:gpt-5");
    expect(DEFAULT_PDF_MODEL_ID).toBe("openai:gpt-5");
    expect(DEFAULT_LIVE_MODEL_ID).toBe("google:gemini-2.5-flash");
  });

  it("lists supported selectable models including Claude Sonnet 4.6", () => {
    expect(SUPPORTED_MODEL_OPTIONS.map((option) => option.id)).toEqual([
      "openai:gpt-5",
      "google:gemini-2.5-flash",
      "anthropic:claude-sonnet-4-6",
    ]);
  });

  it("marks model options unavailable when their API key family is missing", () => {
    const apiKeys = {
      openaiApiKey: "openai-key",
      googleGenerativeAiApiKey: "",
      anthropicApiKey: "",
      anthropicAuthToken: "anthropic-token",
    };

    expect(isModelOptionAvailable(SUPPORTED_MODEL_OPTIONS[0]!, apiKeys)).toBe(true);
    expect(isModelOptionAvailable(SUPPORTED_MODEL_OPTIONS[1]!, apiKeys)).toBe(false);
    expect(isModelOptionAvailable(SUPPORTED_MODEL_OPTIONS[2]!, apiKeys)).toBe(true);
    expect(getAvailableModelOptions(apiKeys).map((option) => option.id)).toEqual([
      "openai:gpt-5",
      "anthropic:claude-sonnet-4-6",
    ]);
  });

  it("builds provider credentials from app settings instead of environment variables", () => {
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "env-openai-key";

    try {
      const options = createProviderRegistryOptions({
        openaiApiKey: "settings-openai-key",
        googleGenerativeAiApiKey: "settings-google-key",
        anthropicApiKey: "settings-anthropic-key",
        anthropicAuthToken: "",
      });
      const emptyOptions = createProviderRegistryOptions(DEFAULT_API_KEY_SETTINGS);

      expect(options.openai).toEqual({ apiKey: "settings-openai-key" });
      expect(options.google).toEqual({ apiKey: "settings-google-key" });
      expect(options.anthropic).toEqual({ apiKey: "settings-anthropic-key" });
      expect(emptyOptions.openai).toEqual({ apiKey: "" });
    } finally {
      if (previousOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousOpenAiKey;
      }
    }
  });

  it("prefers an Anthropic auth token setting over an Anthropic API key setting", () => {
    expect(
      createProviderRegistryOptions({
        openaiApiKey: "",
        googleGenerativeAiApiKey: "",
        anthropicApiKey: "anthropic-key",
        anthropicAuthToken: "anthropic-token",
      }).anthropic,
    ).toEqual({ authToken: "anthropic-token" });
  });

  it("rejects ids without a provider prefix", () => {
    expect(() => parseModelId("gpt-5")).toThrow(
      "Model id must use provider:model format",
    );
  });

  it("rejects unknown providers before resolving a model", () => {
    expect(() => parseModelId("gateway:gpt-5")).toThrow(
      "Unsupported model provider \"gateway\"",
    );
  });
});
