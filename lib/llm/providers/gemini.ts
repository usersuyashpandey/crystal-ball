import { createOpenAICompatibleProvider } from "./openaiCompatible";

/**
 * Google Gemini through its OpenAI-compatible endpoint. Not one of the two
 * providers the brief names (Claude / GPT-4o); it's here because Gemini's
 * free tier needs no card, which makes it a practical way to run the app
 * against a real model during development. Flash models are free-tier.
 */
export const geminiProvider = createOpenAICompatibleProvider({
  name: "gemini",
  apiKeyEnv: "GEMINI_API_KEY",
  modelEnv: "GEMINI_MODEL",
  defaultModel: "gemini-3.8-flash",
  baseURL: () => "https://generativelanguage.googleapis.com/v1beta/openai/",
});
