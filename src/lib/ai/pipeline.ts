import { HumanMessage } from "@langchain/core/messages";
import { createGeminiLLM, createGeminiEmbeddings, parseJsonFromLLMResponse } from "./gemini";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranslationResult {
  translated_text: string;
  detected_language: string;
}

interface LocationResult {
  municipal_ward: string;
}

interface RoutingResult {
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  department_id: string;
  ai_confidence_score: number;
}

interface RagContext {
  resolution_text: string;
  similarity: number;
}

// ─── Step 1: Translation ──────────────────────────────────────────────────────

/**
 * Detects the language of `original_text` and translates it to English.
 * If the text is already in English, translated_text == original_text.
 */
async function translateToEnglish(originalText: string): Promise<TranslationResult> {
  const llm = createGeminiLLM();

  const prompt = `You are a translation assistant. Detect the language of the following text and translate it to English.
If the text is already in English, return it as-is.

Text:
"""
${originalText}
"""

Respond ONLY with a valid JSON object in this exact format (no markdown fences):
{
  "translated_text": "<English translation>",
  "detected_language": "<detected language name in English, e.g. Hindi, Tamil, English>"
}`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const raw = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);

  return parseJsonFromLLMResponse<TranslationResult>(raw);
}

// ─── Step 2: Location Intelligence ───────────────────────────────────────────

/**
 * Uses the user's address landmark and pincode to infer the municipal ward/council.
 */
async function extractMunicipalWard(
  addressLandmark: string,
  pincode: string,
): Promise<LocationResult> {
  const llm = createGeminiLLM();

  const prompt = `You are an Indian municipal geography expert. Given a landmark/address and a 6-digit Indian pincode, determine the most likely Municipal Corporation, Municipal Council, or Gram Panchayat ward that this location belongs to.

Address / Landmark: "${addressLandmark}"
Pincode: ${pincode}

Respond ONLY with a valid JSON object in this exact format (no markdown fences):
{
  "municipal_ward": "<Municipal Body Name – Ward Name or Number, e.g. Brihanmumbai Municipal Corporation – Ward K/West>"
}

If you cannot determine it with reasonable confidence, return your best inference based on the pincode and address. Always return a value.`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const raw = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);

  return parseJsonFromLLMResponse<LocationResult>(raw);
}

// ─── Step 3: RAG Contextual Retrieval ────────────────────────────────────────

/**
 * Embeds the translated complaint text and performs a cosine similarity search
 * against the resolutions table to retrieve the top-k most relevant past resolutions.
 */
async function retrieveRagContext(translatedText: string): Promise<RagContext[]> {
  const embeddings = createGeminiEmbeddings();
  const adminClient = createAdminClient();

  // Generate embedding for the query text
  const queryEmbedding = await embeddings.embedQuery(translatedText);

  // pgvector cosine similarity search via Supabase RPC
  // The function `match_resolutions` must exist in the database (see notes below).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any).rpc("match_resolutions", {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 5,
  });

  if (error) {
    // RAG is best-effort — a failure here should not block routing
    console.warn("RAG retrieval warning:", error.message);
    return [];
  }

  return (data ?? []) as RagContext[];
}

// ─── Step 4: Categorization & Routing ────────────────────────────────────────

/**
 * Given the translated complaint, location info, available departments, and
 * RAG context from past resolutions, asks Gemini to assign:
 * - category (descriptive tag)
 * - priority (low / medium / high / critical)
 * - department_id (UUID from the departments list)
 * - ai_confidence_score (0.0 – 1.0)
 */
async function categorizeAndRoute(
  translatedText: string,
  municipalWard: string,
  ragContext: RagContext[],
  departments: Array<{ id: string; name: string; description: string | null }>,
): Promise<RoutingResult> {
  const llm = createGeminiLLM();

  const departmentList = departments
    .map((d) => `- id: "${d.id}", name: "${d.name}"${d.description ? `, description: "${d.description}"` : ""}`)
    .join("\n");

  const ragSection =
    ragContext.length > 0
      ? ragContext
          .map(
            (r, i) =>
              `Past Resolution ${i + 1} (similarity: ${(r.similarity * 100).toFixed(1)}%):\n${r.resolution_text}`,
          )
          .join("\n\n")
      : "No similar past resolutions found.";

  const prompt = `You are an expert municipal complaint routing system for Indian cities.
Your task is to analyze a citizen complaint and route it to the correct government department.

## Complaint (English)
${translatedText}

## Location
Municipal Ward: ${municipalWard}

## Available Departments
${departmentList}

## Similar Past Resolutions (RAG Context)
${ragSection}

## Instructions
1. Assign a concise category tag (e.g. "Road Pothole", "Water Supply", "Street Light Outage", "Sewage Overflow").
2. Assign a priority level based on urgency and public safety impact:
   - critical: immediate danger to life/health (e.g. sewage contamination of drinking water, collapsed structure)
   - high: significant disruption affecting many people (e.g. major road damage, prolonged power outage)
   - medium: moderate inconvenience affecting a locality (e.g. broken street lights, intermittent water supply)
   - low: minor issues (e.g. dirty park bench, faded road markings)
3. Select the BEST matching department_id from the list above.
4. Provide an ai_confidence_score between 0.0 and 1.0 reflecting your confidence in this routing.

Respond ONLY with a valid JSON object in this exact format (no markdown fences):
{
  "category": "<category tag>",
  "priority": "<low|medium|high|critical>",
  "department_id": "<UUID from the departments list>",
  "ai_confidence_score": <0.0 to 1.0>
}`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const raw = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);

  return parseJsonFromLLMResponse<RoutingResult>(raw);
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export interface PipelineInput {
  complaintId: string;
  originalText: string;
  addressLandmark: string;
  pincode: string;
}

export interface PipelineResult {
  translated_text: string;
  detected_language: string;
  municipal_ward: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  department_id: string;
  ai_confidence_score: number;
}

/**
 * Runs the full AI routing pipeline for a newly submitted complaint:
 *   1. Translate original_text → English
 *   2. Extract municipal ward from address + pincode
 *   3. Embed translated_text and retrieve RAG context from past resolutions
 *   4. Categorize and route to the correct department
 *   5. Update the complaints row in Postgres with all AI-determined values
 */
export async function runRoutingPipeline(input: PipelineInput): Promise<PipelineResult> {
  const adminClient = createAdminClient();

  // ── Fetch departments list (needed for routing step) ──────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: departments, error: deptError } = await (adminClient as any)
    .from("departments")
    .select("id, name, description");

  if (deptError || !departments || departments.length === 0) {
    throw new Error(`Failed to fetch departments: ${deptError?.message ?? "empty result"}`);
  }

  // ── Step 1: Translation ───────────────────────────────────────────────────
  let translationResult: TranslationResult;
  try {
    translationResult = await translateToEnglish(input.originalText);
  } catch (err) {
    console.error("[Pipeline] Translation failed:", err);
    // Fallback: treat original as English
    translationResult = {
      translated_text: input.originalText,
      detected_language: "Unknown",
    };
  }

  // ── Step 2: Location Intelligence ────────────────────────────────────────
  let locationResult: LocationResult;
  try {
    locationResult = await extractMunicipalWard(input.addressLandmark, input.pincode);
  } catch (err) {
    console.error("[Pipeline] Location extraction failed:", err);
    locationResult = { municipal_ward: `Pincode ${input.pincode} area` };
  }

  // ── Step 3: RAG Contextual Retrieval ─────────────────────────────────────
  let ragContext: RagContext[] = [];
  try {
    ragContext = await retrieveRagContext(translationResult.translated_text);
  } catch (err) {
    console.warn("[Pipeline] RAG retrieval failed (non-fatal):", err);
  }

  // ── Step 4: Categorization & Routing ──────────────────────────────────────
  let routingResult: RoutingResult;
  try {
    routingResult = await categorizeAndRoute(
      translationResult.translated_text,
      locationResult.municipal_ward,
      ragContext,
      departments as Array<{ id: string; name: string; description: string | null }>,
    );
  } catch (err) {
    console.error("[Pipeline] Routing failed:", err);
    // Fallback: assign first department, low priority
    routingResult = {
      category: "General Complaint",
      priority: "low",
      department_id: departments[0].id,
      ai_confidence_score: 0.0,
    };
  }

  // ── Step 5: Persist AI results to Postgres ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (adminClient as any)
    .from("complaints")
    .update({
      translated_text: translationResult.translated_text,
      municipal_ward: locationResult.municipal_ward,
      category: routingResult.category,
      priority: routingResult.priority,
      department_id: routingResult.department_id,
      ai_confidence_score: routingResult.ai_confidence_score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.complaintId);

  if (updateError) {
    throw new Error(`Failed to update complaint with AI results: ${(updateError as { message: string }).message}`);
  }

  return {
    translated_text: translationResult.translated_text,
    detected_language: translationResult.detected_language,
    municipal_ward: locationResult.municipal_ward,
    category: routingResult.category,
    priority: routingResult.priority,
    department_id: routingResult.department_id,
    ai_confidence_score: routingResult.ai_confidence_score,
  };
}