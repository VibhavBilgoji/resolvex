import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Always server-rendered — never statically cached on Vercel
export const dynamic = "force-dynamic";
// Ensure this route runs on the Node.js runtime (not Edge),
// because @supabase/supabase-js uses Node-only APIs.
export const runtime = "nodejs";

// Haversine distance in metres between two lat/lng pairs
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const radiusStr = searchParams.get("radius") ?? "500";
  const departmentId = searchParams.get("department_id");
  const adminMode = searchParams.get("admin") === "true";

  // For citizen mode, lat/lng are required
  if (!adminMode && (!latStr || !lngStr)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 },
    );
  }

  const lat = latStr ? parseFloat(latStr) : null;
  const lng = lngStr ? parseFloat(lngStr) : null;
  const radius = parseFloat(radiusStr);

  if (lat !== null && (isNaN(lat) || isNaN(lng!))) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  if (isNaN(radius) || radius <= 0) {
    return NextResponse.json({ error: "Invalid radius" }, { status: 400 });
  }

  // Use admin client to bypass RLS — this endpoint shows public civic data
  const supabase = createAdminClient();

  // Select only fields needed for the map (no PII exposed)
  let query = supabase
    .from("complaints")
    .select(
      "id, title, status, priority, category, latitude, longitude, address_landmark, created_at",
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: false });

  // Admin mode: filter by department, no radius restriction
  if (adminMode && departmentId) {
    query = query.eq("department_id", departmentId);
  } else if (adminMode) {
    // Super admin: return all complaints with location (limit to 500 for safety)
    query = query.limit(500);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[nearby complaints] supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type RawComplaint = {
    id: string;
    title: string;
    status: string;
    priority: string | null;
    category: string | null;
    latitude: number;
    longitude: number;
    address_landmark: string;
    created_at: string;
  };

  const rows = (data ?? []) as RawComplaint[];

  let complaints: RawComplaint[];

  if (!adminMode && lat !== null && lng !== null) {
    // Citizen mode: hard-cap at 500 m
    complaints = rows.filter((c) => {
      const dist = haversineMeters(lat, lng, c.latitude, c.longitude);
      return dist <= radius;
    });
  } else {
    complaints = rows;
  }

  return NextResponse.json(
    { complaints },
    {
      headers: {
        // Very short cache — realtime feel, but avoids hammering the DB on
        // every single map mount on the same client within 1 second.
        "Cache-Control": "private, max-age=1, stale-while-revalidate=2",
      },
    },
  );
}
