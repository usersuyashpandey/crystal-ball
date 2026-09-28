import { createOpenAICompatibleProvider } from "./openaiCompatible";

/**
 * Groq through its OpenAI-compatible endpoint. Like Gemini, not one of the
 * providers the brief names; it's here as a free-tier way to run the app
 * against a real model, and it's fast to first token, which matters with
 * an 8s first-token budget.
 *
 * Default openai/gpt-oss-120b (a Groq production model; Llama 3.3 70B was
 * retired). gpt-oss reasons before answering, so we ask for low effort:
 * measured ~0.5s to first token, with the reply format followed.
 */
export const groqProvider = createOpenAICompatibleProvider({
  name: "groq",
  apiKeyEnv: "GROQ_API_KEY",
  modelEnv: "GROQ_MODEL",
  defaultModel: "openai/gpt-oss-120b",
  baseURL: () => "https://api.groq.com/openai/v1",
  extraParams: (model) => (model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
});
