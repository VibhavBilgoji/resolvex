"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createGeminiEmbeddings } from "./gemini";
import { generateResolutionPlan } from "./summarize";
import { getUser } from "@/lib/auth/utils";
import type { ResolutionPlan } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RagContext {
  resolution_text: string;
  similarity: number;
}

interface ComplaintRow {
  id: string;
  title: string;
  translated_text: string | null;
  original_text: string;
  category: string | null;
  priority: string | null;
  municipal_ward: string | null;
  department_id: string | null;
}

interface DepartmentRow {
  id: string;
  name: string;
}

export type GenerateResolutionPlanResult =
  | { plan: ResolutionPlan; error?: never }
  | { error: string; plan?: never };

/**
 * Server Action: Generate an AI resolution plan for a complaint.
 *
 * Replaces the client-side fetch to /api/complaints/[id]/resolution-plan so
 * that no internal API secret is ever sent to the browser.  The action runs
 * entirely on the server — auth check → RAG retrieval → Gemini plan generation.
 *
 * Accessible only to department_admin and system_super_admin users.
 * Department admins may only generate plans for complaints in their own dept.
 */
export async function generateResolutionPlanAction(
  complaintId: string,
): Promise<GenerateResolutionPlanResult> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const user = await getUser();

  if (!user) {
    return { error: "Unauthorised. Please sign in." };
  }

  if (user.role !== "department_admin" && user.role !== "system_super_admin") {
    return { error: "Forbidden. Admin access required." };
  }

  if (!complaintId) {
    return { error: "Missing complaint ID." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  // ── 1. Fetch the complaint ─────────────────────────────────────────────────
  const { data: complaintRaw, error: compErr } = await adminClient
    .from("complaints")
    .select(
      "id, title, translated_text, original_text, category, priority, municipal_ward, department_id",
    )
    .eq("id", complaintId)
    .single();

  if (compErr || !complaintRaw) {
    return { error: "Complaint not found." };
  }

  const complaint = complaintRaw as ComplaintRow;

  // Department admins may only generate plans for complaints in their dept
  if (
    user.role === "department_admin" &&
    complaint.department_id !== user.departmentId
  ) {
    return { error: "Forbidden. This complaint belongs to another department." };
  }

  // ── 2. Fetch department name ───────────────────────────────────────────────
  let departmentName: string | null = null;
  if (complaint.department_id) {
    const { data: deptRaw } = await adminClient
      .from("departments")
      .select("id, name")
      .eq("id", complaint.department_id)
      .single();
    departmentName = (deptRaw as DepartmentRow | null)?.name ?? null;
  }

  // ── 3. RAG retrieval — find similar past resolutions ──────────────────────
  const complaintText =
    complaint.translated_text ?? complaint.original_text ?? "";

  let ragContext: RagContext[] = [];
  try {
    const embeddings = createGeminiEmbeddings();
    const queryEmbedding = await embeddings.embedQuery(complaintText);

    const { data: ragRaw } = await adminClient.rpc("match_resolutions", {
      query_embedding: queryEmbedding,
      match_threshold: 0.45,
      match_count: 4,
    });

    ragContext = (ragRaw ?? []) as RagContext[];
  } catch (err) {
    // RAG is best-effort — proceed without context rather than failing
    console.warn(
      "[generateResolutionPlanAction] RAG retrieval failed (non-fatal):",
      err,
    );
  }

  // ── 4. Generate resolution plan ───────────────────────────────────────────
  try {
    const plan = await generateResolutionPlan({
      complaintText,
      title: complaint.title,
      category: complaint.category,
      priority: complaint.priority,
      municipalWard: complaint.municipal_ward,
      departmentName,
      ragContext,
    });

    return { plan };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown generation error";
    console.error("[generateResolutionPlanAction] Generation error:", message);
    return {
      error:
        "Failed to generate resolution plan. Please try again in a moment.",
    };
  }
}
