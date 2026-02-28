"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/utils";

export type ResolutionActionResult = {
  error?: string;
  success?: boolean;
};

// ─── Update complaint status only (e.g. open → in_progress) ──────────────────

export async function updateComplaintStatus(
  complaintId: string,
  status: "open" | "in_progress" | "resolved" | "rejected",
): Promise<ResolutionActionResult> {
  const user = await getUser();
  if (!user) return { error: "Unauthorised." };
  if (user.role !== "department_admin" && user.role !== "system_super_admin") {
    return { error: "Forbidden." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  // Department admins may only touch complaints in their own department
  if (user.role === "department_admin") {
    const { data: complaint, error: fetchErr } = await adminClient
      .from("complaints")
      .select("department_id")
      .eq("id", complaintId)
      .single();

    if (fetchErr || !complaint) return { error: "Complaint not found." };
    const c = complaint as { department_id: string | null };
    if (c.department_id !== user.departmentId) {
      return { error: "You are not authorised to update this complaint." };
    }
  }

  const { error } = await adminClient
    .from("complaints")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", complaintId);

  if (error) {
    console.error("[updateComplaintStatus]", error.message);
    return { error: "Failed to update status. Please try again." };
  }

  revalidatePath(`/admin/complaints/${complaintId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/complaints");

  return { success: true };
}

// ─── Resolve a complaint (write resolution note + update status) ──────────────

export async function resolveComplaint(
  complaintId: string,
  resolutionText: string,
): Promise<ResolutionActionResult> {
  const user = await getUser();
  if (!user) return { error: "Unauthorised." };
  if (user.role !== "department_admin" && user.role !== "system_super_admin") {
    return { error: "Forbidden." };
  }

  const text = resolutionText.trim();
  if (!text || text.length < 20) {
    return { error: "Resolution note must be at least 20 characters." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  // Department admins may only resolve complaints in their own department
  if (user.role === "department_admin") {
    const { data: complaint, error: fetchErr } = await adminClient
      .from("complaints")
      .select("department_id")
      .eq("id", complaintId)
      .single();

    if (fetchErr || !complaint) return { error: "Complaint not found." };
    const c = complaint as { department_id: string | null };
    if (c.department_id !== user.departmentId) {
      return { error: "You are not authorised to resolve this complaint." };
    }
  }

  // Insert the resolution record (embedding will be filled by the learning loop)
  const { data: resolution, error: insertErr } = await adminClient
    .from("resolutions")
    .insert({
      complaint_id: complaintId,
      resolved_by: user.id,
      resolution_text: text,
    })
    .select("id")
    .single();

  if (insertErr || !resolution) {
    console.error("[resolveComplaint] insert error:", insertErr?.message);
    return { error: "Failed to save resolution. Please try again." };
  }

  const resolutionId = (resolution as { id: string }).id;

  // Update complaint status to resolved
  const { error: updateErr } = await adminClient
    .from("complaints")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", complaintId);

  if (updateErr) {
    console.error("[resolveComplaint] status update error:", updateErr.message);
    return {
      error:
        "Resolution saved but status update failed. Please refresh and verify.",
    };
  }

  // Trigger the learning loop — embed the resolution asynchronously via route handler.
  // We use a fire-and-forget fetch to the internal API route so the server action
  // returns immediately without waiting for the Gemini embedding call.
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Intentionally NOT awaited — fire-and-forget
    fetch(`${baseUrl}/api/resolutions/${resolutionId}/embed`, {
      method: "POST",
      headers: {
        "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
      },
    }).catch((err) => {
      console.warn("[resolveComplaint] embed trigger failed (non-fatal):", err);
    });
  } catch {
    // Embedding is best-effort and must never block the resolution flow
  }

  revalidatePath(`/admin/complaints/${complaintId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/complaints");

  return { success: true };
}