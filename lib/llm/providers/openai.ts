import { createOpenAICompatibleProvider } from "./openaiCompatible";

/** GPT-4o by default (the brief's alternative to Claude). */
export const openaiProvider = createOpenAICompatibleProvider({
  name: "openai",
  apiKeyEnv: "OPENAI_API_KEY",
  modelEnv: "OPENAI_MODEL",
  defaultModel: "gpt-4o",
});
