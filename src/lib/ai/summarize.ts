import { HumanMessage } from "@langchain/core/messages";
import { createGeminiLLM, parseJsonFromLLMResponse } from "./gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ComplaintSummaryFields,
  ResolutionPlan,
  ResolutionPlanStep,
  ResolutionTimeline,
} from "@/types/database";

// ─── Re-export types so callers can import from one place ─────────────────────
export type { ComplaintSummaryFields, ResolutionPlan, ResolutionPlanStep };

// ─── Internal RAG context shape (mirrors pipeline.ts) ────────────────────────
interface RagContext {
  resolution_text: string;
  similarity: number;
}

// ─── Step A: Summarize & Extract Structured Fields ───────────────────────────

/**
 * Calls Gemini to produce a structured summary of a complaint, extracting:
 * - one_line_summary    — concise sentence describing the issue
 * - location_detail     — parsed/enriched location description
 * - department_reasoning — why this department was selected
 * - urgency             — low / medium / high / critical
 * - urgency_explanation — human-readable rationale
 * - key_issues          — bullet list of discrete problems
 * - affected_scope      — who / how many people are affected
 * - tags                — short keyword tags for search/filter
 */
export async function summarizeComplaint(input: {
  complaintText: string;
  addressLandmark: string;
  pincode: string;
  municipalWard: string | null;
  category: string | null;
  priority: string | null;
  departmentName: string | null;
}): Promise<ComplaintSummaryFields> {
  const llm = createGeminiLLM();

  const contextBlock = [
    input.municipalWard ? `Municipal Ward: ${input.municipalWard}` : null,
    `Address / Landmark: ${input.addressLandmark}`,
    `Pincode: ${input.pincode}`,
    input.category ? `AI Category: ${input.category}` : null,
    input.priority ? `AI Priority: ${input.priority}` : null,
    input.departmentName ? `Assigned Department: ${input.departmentName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are an expert municipal grievance analyst. Analyse the following citizen complaint and extract structured information for use by department officials.

## Complaint Text (English)
"""
${input.complaintText}
"""

## Routing Context
${contextBlock}

## Instructions
Return ONLY a valid JSON object in this exact format (no markdown fences):
{
  "one_line_summary": "<single sentence, max 20 words, describing the core issue>",
  "location_detail": "<enriched location description combining address, ward and pincode context>",
  "department_reasoning": "<1–2 sentences explaining why this department is responsible>",
  "urgency": "<low|medium|high|critical>",
  "urgency_explanation": "<1–2 sentences explaining the urgency rating>",
  "key_issues": ["<issue 1>", "<issue 2>", "<issue 3 if applicable>"],
  "affected_scope": "<who and how many people are affected, e.g. 'Residents of 3 housing blocks (~200 people)'>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}

Rules:
- key_issues: 2–5 bullet points, each under 15 words
- tags: 3–6 short keyword tags (e.g. "pothole", "road", "K-West ward")
- urgency must match the ai_priority if provided; override only if text clearly warrants it
- Be factual; do not invent information not present in the complaint`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const raw =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  return parseJsonFromLLMResponse<ComplaintSummaryFields>(raw);
}

// ─── Step B: Generate Resolution Plan ────────────────────────────────────────

/**
 * Generates an actionable, step-by-step resolution plan for a complaint.
 * Uses RAG context (similar past resolutions) to produce informed recommendations.
 *
 * Steps are categorised into:
 *   - immediate   : within 24 hours
 *   - short_term  : within 1 week
 *   - long_term   : beyond 1 week / preventive
 */
export async function generateResolutionPlan(input: {
  complaintText: string;
  title: string;
  category: string | null;
  priority: string | null;
  municipalWard: string | null;
  departmentName: string | null;
  ragContext: RagContext[];
}): Promise<ResolutionPlan> {
  const llm = createGeminiLLM();

  const ragSection =
    input.ragContext.length > 0
      ? input.ragContext
          .map(
            (r, i) =>
              `Past Resolution ${i + 1} (similarity ${(r.similarity * 100).toFixed(0)}%):\n${r.resolution_text}`,
          )
          .join("\n\n")
      : "No similar past resolutions available.";

  const contextBlock = [
    `Title: ${input.title}`,
    input.category ? `Category: ${input.category}` : null,
    input.priority ? `Priority: ${input.priority}` : null,
    input.municipalWard ? `Municipal Ward: ${input.municipalWard}` : null,
    input.departmentName ? `Responsible Department: ${input.departmentName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a senior municipal operations advisor. Generate a detailed, actionable resolution plan for the following civic complaint. Use the similar past resolutions as reference.

## Complaint
${contextBlock}

Description:
"""
${input.complaintText}
"""

## Similar Past Resolutions (RAG Context)
${ragSection}

## Instructions
Return ONLY a valid JSON object (no markdown fences) with this exact structure:
{
  "executive_summary": "<2–3 sentence overview of the situation and recommended approach>",
  "steps": [
    {
      "timeline": "immediate",
      "action": "<specific action to take within 24 hours>",
      "responsible_party": "<who should do this, e.g. Field Engineer, Control Room, Ward Officer>"
    },
    {
      "timeline": "short_term",
      "action": "<action within 1 week>",
      "responsible_party": "<who>"
    },
    {
      "timeline": "long_term",
      "action": "<preventive or follow-up action beyond 1 week>",
      "responsible_party": "<who>"
    }
  ],
  "required_resources": ["<resource 1>", "<resource 2>"],
  "escalation_trigger": "<condition under which this should be escalated to a senior officer>",
  "estimated_time": "<realistic time range to full resolution, e.g. '2–5 business days'>",
  "similar_context": "<1–2 sentences referencing lessons from past similar resolutions, or 'No similar cases found' if none>"
}

Rules:
- Include 3–6 steps total; at least one per timeline bucket
- steps must be concrete and actionable, not generic
- required_resources: 2–5 items (equipment, personnel, permits, etc.)
- Base estimated_time on complexity and priority; critical issues should be resolved in < 24 h`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const raw =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  const parsed = parseJsonFromLLMResponse<{
    executive_summary: string;
    steps: Array<{
      timeline: string;
      action: string;
      responsible_party: string;
    }>;
    required_resources: string[];
    escalation_trigger: string;
    estimated_time: string;
    similar_context: string;
  }>(raw);

  // Normalise timeline values to the union type
  const validTimelines: ResolutionTimeline[] = [
    "immediate",
    "short_term",
    "long_term",
  ];

  const steps: ResolutionPlanStep[] = (parsed.steps ?? []).map((s) => ({
    timeline: validTimelines.includes(s.timeline as ResolutionTimeline)
      ? (s.timeline as ResolutionTimeline)
      : "short_term",
    action: s.action,
    responsible_party: s.responsible_party,
  }));

  return {
    executive_summary: parsed.executive_summary,
    steps,
    required_resources: parsed.required_resources ?? [],
    escalation_trigger: parsed.escalation_trigger,
    estimated_time: parsed.estimated_time,
    similar_context: parsed.similar_context,
  };
}

// ─── Convenience: Run summarize + persist to DB ───────────────────────────────

/**
 * Generates the AI summary for a complaint and persists it to the
 * complaints.ai_summary column. Called from the routing pipeline after routing.
 * Errors are non-fatal — a failure here must not block complaint submission.
 */
export async function runSummarizePipeline(input: {
  complaintId: string;
  complaintText: string;
  addressLandmark: string;
  pincode: string;
  municipalWard: string | null;
  category: string | null;
  priority: string | null;
  departmentName: string | null;
}): Promise<ComplaintSummaryFields | null> {
  try {
    const summary = await summarizeComplaint({
      complaintText: input.complaintText,
      addressLandmark: input.addressLandmark,
      pincode: input.pincode,
      municipalWard: input.municipalWard,
      category: input.category,
      priority: input.priority,
      departmentName: input.departmentName,
    });

    // Persist to DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = createAdminClient() as any;
    const { error } = await adminClient
      .from("complaints")
      .update({ ai_summary: summary, updated_at: new Date().toISOString() })
      .eq("id", input.complaintId);

    if (error) {
      console.error("[summarize] DB persist error:", error.message);
    }

    return summary;
  } catch (err) {
    console.error("[summarize] Pipeline error (non-fatal):", err);
    return null;
  }
}
