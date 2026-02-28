import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGeminiEmbeddings } from "@/lib/ai/gemini";
import { generateResolutionPlan } from "@/lib/ai/summarize";

export const runtime = "nodejs";

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

/**
 * POST /api/complaints/[id]/resolution-plan
 *
 * Generates an AI-powered, step-by-step resolution plan for a complaint.
 * Uses RAG retrieval against past resolutions for context.
 * This is an on-demand endpoint — the plan is NOT persisted (it is ephemeral
 * guidance for the resolving admin and may change as new resolutions are added).
 *
 * Auth: caller must pass `x-internal-secret` header (same secret used by the
 * embed route) so that only server-side code can call this. The admin page
 * server component fetches this directly on the server, keeping the key hidden.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Secret check (lightweight; prevents accidental public exposure) ─────────
  const secret = request.headers.get("x-internal-secret") ?? "";
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? "";
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id: complaintId } = await params;
  if (!complaintId) {
    return NextResponse.json(
      { error: "Missing complaint ID." },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  // ── 1. Fetch the complaint ──────────────────────────────────────────────────
  const { data: complaintRaw, error: compErr } = await adminClient
    .from("complaints")
    .select(
      "id, title, translated_text, original_text, category, priority, municipal_ward, department_id",
    )
    .eq("id", complaintId)
    .single();

  if (compErr || !complaintRaw) {
    return NextResponse.json(
      { error: "Complaint not found." },
      { status: 404 },
    );
  }

  const complaint = complaintRaw as ComplaintRow;

  // ── 2. Fetch department name ────────────────────────────────────────────────
  let departmentName: string | null = null;
  if (complaint.department_id) {
    const { data: deptRaw } = await adminClient
      .from("departments")
      .select("id, name")
      .eq("id", complaint.department_id)
      .single();
    departmentName = (deptRaw as DepartmentRow | null)?.name ?? null;
  }

  // ── 3. RAG retrieval — find similar past resolutions ───────────────────────
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
    // RAG is best-effort; proceed without context
    console.warn("[resolution-plan] RAG retrieval failed (non-fatal):", err);
  }

  // ── 4. Generate resolution plan ────────────────────────────────────────────
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

    return NextResponse.json({ plan }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown generation error";
    console.error("[resolution-plan] Generation error:", message);
    return NextResponse.json(
      { error: "Failed to generate resolution plan.", detail: message },
      { status: 500 },
    );
  }
}
