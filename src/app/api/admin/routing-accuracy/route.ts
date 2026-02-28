import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/routing-accuracy
 *
 * Returns routing accuracy analytics derived from admin feedback stored on
 * the resolutions table (routing_was_correct, admin_corrected_department_id).
 *
 * Shape:
 * {
 *   total_with_feedback: number,
 *   correct: number,
 *   incorrect: number,
 *   accuracy_pct: number,           // 0–100
 *   corrections: [                  // top mis-routed patterns
 *     {
 *       from_department: string,
 *       to_department: string,
 *       count: number,
 *     }
 *   ],
 *   by_category: [                  // accuracy broken down by AI category
 *     {
 *       category: string,
 *       total: number,
 *       correct: number,
 *       accuracy_pct: number,
 *     }
 *   ]
 * }
 *
 * Secured by INTERNAL_API_SECRET header so only server-side calls succeed.
 */
export async function GET(request: NextRequest) {
  // ── Auth: lightweight secret check ─────────────────────────────────────────
  const secret = request.headers.get("x-internal-secret") ?? "";
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? "";
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;

  // ── 1. Fetch all resolutions that have routing feedback ─────────────────────
  const { data: resolutionsRaw, error: resErr } = await adminClient
    .from("resolutions")
    .select(
      "id, routing_was_correct, admin_corrected_department_id, complaint_id",
    )
    .not("routing_was_correct", "is", null);

  if (resErr) {
    console.error("[routing-accuracy] resolutions fetch error:", resErr.message);
    return NextResponse.json(
      { error: "Failed to fetch resolution data." },
      { status: 500 },
    );
  }

  const resolutions = (resolutionsRaw ?? []) as Array<{
    id: string;
    routing_was_correct: boolean;
    admin_corrected_department_id: string | null;
    complaint_id: string;
  }>;

  const totalWithFeedback = resolutions.length;
  const correct = resolutions.filter((r) => r.routing_was_correct).length;
  const incorrect = totalWithFeedback - correct;
  const accuracyPct =
    totalWithFeedback > 0
      ? Math.round((correct / totalWithFeedback) * 100)
      : 0;

  // ── 2. Fetch complaint data for misrouted resolutions ───────────────────────
  const incorrectResolutions = resolutions.filter(
    (r) => !r.routing_was_correct && r.admin_corrected_department_id,
  );

  // Collect all complaint IDs for incorrect resolutions
  const complaintIds = incorrectResolutions.map((r) => r.complaint_id);

  // Collect all unique department IDs we need to look up
  const allDeptIds = new Set<string>();
  incorrectResolutions.forEach((r) => {
    if (r.admin_corrected_department_id)
      allDeptIds.add(r.admin_corrected_department_id);
  });

  // Fetch complaints to get the original (AI-assigned) department_id
  let complaintsMap: Record<
    string,
    { department_id: string | null; category: string | null }
  > = {};

  if (complaintIds.length > 0) {
    const { data: complaintsRaw } = await adminClient
      .from("complaints")
      .select("id, department_id, category")
      .in("id", complaintIds);

    if (complaintsRaw) {
      complaintsMap = (
        complaintsRaw as Array<{
          id: string;
          department_id: string | null;
          category: string | null;
        }>
      ).reduce(
        (acc, c) => {
          acc[c.id] = {
            department_id: c.department_id,
            category: c.category,
          };
          return acc;
        },
        {} as typeof complaintsMap,
      );

      // Add original department IDs to the lookup set
      Object.values(complaintsMap).forEach((c) => {
        if (c.department_id) allDeptIds.add(c.department_id);
      });
    }
  }

  // ── 3. Fetch all relevant department names ──────────────────────────────────
  let deptNameMap: Record<string, string> = {};
  if (allDeptIds.size > 0) {
    const { data: deptsRaw } = await adminClient
      .from("departments")
      .select("id, name")
      .in("id", Array.from(allDeptIds));

    if (deptsRaw) {
      deptNameMap = (deptsRaw as Array<{ id: string; name: string }>).reduce(
        (acc, d) => {
          acc[d.id] = d.name;
          return acc;
        },
        {} as Record<string, string>,
      );
    }
  }

  // ── 4. Compute corrections tally (from_dept → to_dept → count) ─────────────
  const correctionsTally: Record<string, number> = {};
  incorrectResolutions.forEach((r) => {
    const complaint = complaintsMap[r.complaint_id];
    const fromDeptId = complaint?.department_id ?? "unknown";
    const toDeptId = r.admin_corrected_department_id ?? "unknown";

    const fromName = deptNameMap[fromDeptId] ?? `Dept ${fromDeptId.slice(0, 8)}`;
    const toName = deptNameMap[toDeptId] ?? `Dept ${toDeptId.slice(0, 8)}`;

    const key = `${fromName}|||${toName}`;
    correctionsTally[key] = (correctionsTally[key] ?? 0) + 1;
  });

  const corrections = Object.entries(correctionsTally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => {
      const [from_department, to_department] = key.split("|||");
      return { from_department, to_department, count };
    });

  // ── 5. Accuracy broken down by AI category ──────────────────────────────────
  // Build a map: complaintId → { category, routing_was_correct }
  const categoryAccMap: Record<
    string,
    { total: number; correct: number }
  > = {};

  // Include all resolutions with feedback (correct + incorrect)
  for (const res of resolutions) {
    const complaint = complaintsMap[res.complaint_id];
    // For correct resolutions, we don't have the complaint in complaintsMap
    // (we only fetched incorrect complaint data) — fetch categories separately
    const category =
      complaint?.category ??
      (res.routing_was_correct ? null : null); // handled below

    if (category) {
      if (!categoryAccMap[category]) {
        categoryAccMap[category] = { total: 0, correct: 0 };
      }
      categoryAccMap[category].total += 1;
      if (res.routing_was_correct) categoryAccMap[category].correct += 1;
    }
  }

  // Also fetch categories for correct resolutions (not in complaintsMap yet)
  const correctResolutionComplaintIds = resolutions
    .filter((r) => r.routing_was_correct)
    .map((r) => r.complaint_id);

  if (correctResolutionComplaintIds.length > 0) {
    const { data: correctComplaintsRaw } = await adminClient
      .from("complaints")
      .select("id, category")
      .in("id", correctResolutionComplaintIds);

    if (correctComplaintsRaw) {
      (correctComplaintsRaw as Array<{ id: string; category: string | null }>).forEach(
        (c) => {
          if (!c.category) return;
          if (!categoryAccMap[c.category]) {
            categoryAccMap[c.category] = { total: 0, correct: 0 };
          }
          categoryAccMap[c.category].total += 1;
          categoryAccMap[c.category].correct += 1;
        },
      );
    }
  }

  const byCategory = Object.entries(categoryAccMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15)
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      correct: stats.correct,
      accuracy_pct:
        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }));

  return NextResponse.json({
    total_with_feedback: totalWithFeedback,
    correct,
    incorrect,
    accuracy_pct: accuracyPct,
    corrections,
    by_category: byCategory,
  });
}
