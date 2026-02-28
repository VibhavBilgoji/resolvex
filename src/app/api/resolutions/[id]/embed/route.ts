import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGeminiEmbeddings } from "@/lib/ai/gemini";

// This route handler is called internally (fire-and-forget) by the resolveComplaint
// server action after a resolution record is created.  It embeds the resolution text
// concatenated with the complaint summary and stores the resulting vector in the
// resolutions.resolution_embedding column — closing the RAG learning loop.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Optional lightweight secret check to prevent accidental public calls.
  const secret = request.headers.get("x-internal-secret") ?? "";
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? "";
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id: resolutionId } = await params;

  if (!resolutionId) {
    return NextResponse.json(
      { error: "Resolution ID is required." },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  // ── 1. Fetch resolution + linked complaint summary ──────────────────────────
  const { data: resolutionRaw, error: resErr } = await adminClient
    .from("resolutions")
    .select(
      "id, resolution_text, complaint_id, routing_was_correct, admin_corrected_department_id",
    )
    .eq("id", resolutionId)
    .single();

  if (resErr || !resolutionRaw) {
    console.error("[embed] Resolution fetch error:", resErr?.message);
    return NextResponse.json(
      { error: "Resolution not found." },
      { status: 404 },
    );
  }

  const resolution = resolutionRaw as {
    id: string;
    resolution_text: string;
    complaint_id: string;
    routing_was_correct: boolean | null;
    admin_corrected_department_id: string | null;
  };

  // Fetch the complaint to build a richer embedding document
  const { data: complaintRaw, error: compErr } = await adminClient
    .from("complaints")
    .select(
      "title, translated_text, original_text, category, municipal_ward, pincode, department_id",
    )
    .eq("id", resolution.complaint_id)
    .single();

  if (compErr) {
    console.warn("[embed] Complaint fetch warning:", compErr?.message);
  }

  const complaint = complaintRaw as {
    title: string | null;
    translated_text: string | null;
    original_text: string | null;
    category: string | null;
    municipal_ward: string | null;
    pincode: string | null;
    department_id: string | null;
  } | null;

  // ── 2. Fetch corrected department name (if admin changed the routing) ──────
  let correctedDepartmentName: string | null = null;
  if (resolution.admin_corrected_department_id) {
    const { data: deptRaw } = await adminClient
      .from("departments")
      .select("name")
      .eq("id", resolution.admin_corrected_department_id)
      .single();
    correctedDepartmentName =
      (deptRaw as { name: string } | null)?.name ?? null;
  }

  // Fetch original department name for the "correct routing" case
  let originalDepartmentName: string | null = null;
  if (complaint?.department_id && resolution.routing_was_correct !== false) {
    const { data: origDeptRaw } = await adminClient
      .from("departments")
      .select("name")
      .eq("id", complaint.department_id)
      .single();
    originalDepartmentName =
      (origDeptRaw as { name: string } | null)?.name ?? null;
  }

  // ── 3. Build the embedding document ────────────────────────────────────────
  // Concatenate the complaint summary with the resolution text and routing
  // feedback signals so that future RAG similarity searches can match on:
  //  - complaint context (title, description, category, ward, pincode)
  //  - routing correctness (which department was right)
  //  - resolution approach (what actions were taken)
  const routingSignal =
    resolution.routing_was_correct === true
      ? `Routing: Correct (Department: ${originalDepartmentName ?? "confirmed"})`
      : resolution.routing_was_correct === false
        ? `Routing: Incorrect — AI misrouted. Correct department: ${correctedDepartmentName ?? resolution.admin_corrected_department_id ?? "reassigned"}`
        : null;

  const complaintContext = complaint
    ? [
        complaint.title ? `Complaint: ${complaint.title}` : null,
        (complaint.translated_text ?? complaint.original_text)
          ? `Description: ${complaint.translated_text ?? complaint.original_text}`
          : null,
        complaint.category ? `Category: ${complaint.category}` : null,
        complaint.municipal_ward ? `Ward: ${complaint.municipal_ward}` : null,
        complaint.pincode ? `Pincode: ${complaint.pincode}` : null,
        routingSignal,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const documentToEmbed = [
    complaintContext,
    `Resolution: ${resolution.resolution_text}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ── 4. Generate embedding via Gemini text-embedding-004 ────────────────────
  let embedding: number[];
  try {
    const embeddings = createGeminiEmbeddings();
    embedding = await embeddings.embedQuery(documentToEmbed);
  } catch (err) {
    console.error("[embed] Gemini embedding error:", err);
    return NextResponse.json(
      { error: "Embedding generation failed." },
      { status: 500 },
    );
  }

  // ── 5. Persist the embedding into the resolutions table ────────────────────
  // Supabase JS client accepts a plain number[] for vector columns when pgvector
  // is enabled — it serialises it as a bracketed float list internally.
  const { error: updateErr } = await adminClient
    .from("resolutions")
    .update({ resolution_embedding: embedding })
    .eq("id", resolutionId);

  if (updateErr) {
    console.error("[embed] Embedding persist error:", updateErr.message);
    return NextResponse.json(
      { error: "Failed to store embedding." },
      { status: 500 },
    );
  }

  console.log(
    `[embed] Resolution ${resolutionId} embedded successfully (${embedding.length}d).`,
  );

  return NextResponse.json({ success: true, dimensions: embedding.length });
}
