import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry } from "ai";

import {
  DEFAULT_API_KEY_SETTINGS,
  DEFAULT_LIVE_MODEL_ID,
  DEFAULT_PDF_MODEL_ID,
  type ApiKeySettings,
} from "../config/app-settings.js";

export const DEFAULT_MODEL_ID = DEFAULT_PDF_MODEL_ID;
export { DEFAULT_LIVE_MODEL_ID, DEFAULT_PDF_MODEL_ID };
export { DEFAULT_API_KEY_SETTINGS, type ApiKeySettings };

const supportedProviders = ["openai", "google", "anthropic"] as const;
type SupportedProvider = (typeof supportedProviders)[number];

export interface ParsedModelId {
  provider: SupportedProvider;
  model: string;
}

export interface ProviderRegistryOptions {
  openai: { apiKey: string };
  google: { apiKey: string };
  anthropic: { apiKey: string } | { authToken: string };
}

export interface SupportedModelOption {
  id: `${SupportedProvider}:${string}`;
  provider: SupportedProvider;
  label: string;
  missingCredentialLabel: string;
}

export const SUPPORTED_MODEL_OPTIONS: SupportedModelOption[] = [
  {
    id: "openai:gpt-5",
    provider: "openai",
    label: "GPT-5",
    missingCredentialLabel: "OpenAI API key",
  },
  {
    id: "google:gemini-2.5-flash",
    provider: "google",
    label: "Gemini 2.5 Flash",
    missingCredentialLabel: "Google Generative AI API key",
  },
  {
    id: "anthropic:claude-sonnet-4-6",
    provider: "anthropic",
    label: "Claude Sonnet 4.6",
    missingCredentialLabel: "Anthropic API key or auth token",
  },
];

export function createProviderRegistryOptions(
  apiKeys: ApiKeySettings = DEFAULT_API_KEY_SETTINGS,
): ProviderRegistryOptions {
  return {
    openai: { apiKey: apiKeys.openaiApiKey },
    google: { apiKey: apiKeys.googleGenerativeAiApiKey },
    anthropic: apiKeys.anthropicAuthToken
      ? { authToken: apiKeys.anthropicAuthToken }
      : { apiKey: apiKeys.anthropicApiKey },
  };
}

function createConfiguredProviderRegistry(
  apiKeys: ApiKeySettings = DEFAULT_API_KEY_SETTINGS,
) {
  const options = createProviderRegistryOptions(apiKeys);
  return createProviderRegistry({
    openai: createOpenAI(options.openai),
    google: createGoogleGenerativeAI(options.google),
    anthropic: createAnthropic(options.anthropic),
  });
}

export type ResolvedLanguageModel = ReturnType<
  ReturnType<typeof createConfiguredProviderRegistry>["languageModel"]
>;

export function parseModelId(modelId: string): ParsedModelId {
  const separatorIndex = modelId.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === modelId.length - 1) {
    throw new Error("Model id must use provider:model format");
  }

  const provider = modelId.slice(0, separatorIndex);
  const model = modelId.slice(separatorIndex + 1);

  if (!isSupportedProvider(provider)) {
    throw new Error(
      `Unsupported model provider "${provider}". Supported providers: ${supportedProviders.join(
        ", ",
      )}`,
    );
  }

  return { provider, model };
}

export function resolveLanguageModel(
  modelId: string,
  apiKeys: ApiKeySettings = DEFAULT_API_KEY_SETTINGS,
): ResolvedLanguageModel {
  parseModelId(modelId);
  return createConfiguredProviderRegistry(apiKeys).languageModel(
    modelId as `${SupportedProvider}:${string}`,
  ) as ResolvedLanguageModel;
}

export function isModelOptionAvailable(
  option: SupportedModelOption,
  apiKeys: ApiKeySettings = DEFAULT_API_KEY_SETTINGS,
): boolean {
  if (option.provider === "openai") return apiKeys.openaiApiKey.trim() !== "";
  if (option.provider === "google") {
    return apiKeys.googleGenerativeAiApiKey.trim() !== "";
  }
  return (
    apiKeys.anthropicApiKey.trim() !== "" ||
    apiKeys.anthropicAuthToken.trim() !== ""
  );
}

export function getAvailableModelOptions(
  apiKeys: ApiKeySettings = DEFAULT_API_KEY_SETTINGS,
): SupportedModelOption[] {
  return SUPPORTED_MODEL_OPTIONS.filter((option) =>
    isModelOptionAvailable(option, apiKeys),
  );
}

export function assertModelHasCredentials(
  modelId: string,
  apiKeys: ApiKeySettings = DEFAULT_API_KEY_SETTINGS,
): void {
  const missingCredential = getMissingCredentialLabel(modelId, apiKeys);
  if (missingCredential) {
    throw new Error(`Missing ${missingCredential} for ${modelId}.`);
  }
}

function isSupportedProvider(provider: string): provider is SupportedProvider {
  return supportedProviders.includes(provider as SupportedProvider);
}

function getMissingCredentialLabel(
  modelId: string,
  apiKeys: ApiKeySettings,
): string | null {
  const { provider } = parseModelId(modelId);

  if (provider === "openai") {
    return apiKeys.openaiApiKey.trim() === "" ? "OpenAI API key" : null;
  }

  if (provider === "google") {
    return apiKeys.googleGenerativeAiApiKey.trim() === ""
      ? "Google Generative AI API key"
      : null;
  }

  return apiKeys.anthropicApiKey.trim() === "" &&
    apiKeys.anthropicAuthToken.trim() === ""
    ? "Anthropic API key or auth token"
    : null;
}
