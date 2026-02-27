import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

/**
 * Gemini 2.0 Flash chat model for structured AI tasks.
 * Temperature 0 for deterministic JSON output.
 */
export function createGeminiLLM() {
  return new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY!,
    temperature: 0,
  });
}

/**
 * Gemini text-embedding-004 model — outputs 768-dim vectors.
 * Must match the vector(768) column in the resolutions table.
 */
export function createGeminiEmbeddings() {
  return new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
    apiKey: process.env.GEMINI_API_KEY!,
  });
}

/**
 * Parse a JSON block from a Gemini response.
 * Gemini sometimes wraps output in ```json ... ``` fences — this strips them.
 */
export function parseJsonFromLLMResponse<T>(raw: string): T {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned) as T;
}