import { createOpenAICompatibleProvider } from "./openaiCompatible";

/**
 * Groq through its OpenAI-compatible endpoint. Like Gemini, not one of the
 * providers the brief names; it's here as a free-tier way to run the app
 * against a real model. Groq is usually very fast to first token, which
 * matters with an 8s first-token budget. Llama 3.3 70B follows the
 * narrative + structured-JSON reply format well.
 */
export const groqProvider = createOpenAICompatibleProvider({
  name: "groq",
  apiKeyEnv: "GROQ_API_KEY",
  modelEnv: "GROQ_MODEL",
  defaultModel: "llama-3.3-70b-versatile",
  baseURL: () => "https://api.groq.com/openai/v1",
});
