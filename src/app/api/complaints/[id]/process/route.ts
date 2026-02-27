import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRoutingPipeline } from "@/lib/ai/pipeline";

export const runtime = "nodejs";

// This route is called internally (fire-and-forget) after a complaint is submitted.
// It runs the full AI pipeline: translate → location → RAG → categorize & route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: complaintId } = await params;

  if (!complaintId) {
    return NextResponse.json({ error: "Missing complaint ID" }, { status: 400 });
  }

  // Verify the complaint exists and fetch fields needed for the pipeline
  const adminClient = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: complaint, error: fetchError } = await (adminClient as any)
    .from("complaints")
    .select("id, original_text, address_landmark, pincode, translated_text")
    .eq("id", complaintId)
    .single();

  if (fetchError || !complaint) {
    return NextResponse.json(
      { error: "Complaint not found" },
      { status: 404 },
    );
  }

  // If already processed (translated_text set), skip to avoid double-processing
  if (complaint.translated_text) {
    return NextResponse.json(
      { message: "Already processed", complaintId },
      { status: 200 },
    );
  }

  try {
    const result = await runRoutingPipeline({
      complaintId: complaint.id,
      originalText: complaint.original_text,
      addressLandmark: complaint.address_landmark,
      pincode: complaint.pincode,
    });

    return NextResponse.json(
      {
        message: "Pipeline completed successfully",
        complaintId,
        result,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error(`[/api/complaints/${complaintId}/process] Pipeline error:`, message);

    return NextResponse.json(
      { error: "AI pipeline failed", detail: message },
      { status: 500 },
    );
  }
}