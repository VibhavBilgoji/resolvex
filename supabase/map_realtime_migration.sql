-- ============================================================
-- ResolveX — Map & Realtime Migration
-- Run this in the Supabase SQL Editor AFTER migrations.sql
-- ============================================================

-- ============================================================
-- 1. ENABLE REALTIME ON COMPLAINTS TABLE
-- ============================================================

-- Supabase Realtime postgres_changes requires REPLICA IDENTITY FULL
-- so that UPDATE and DELETE payloads include the full old row.
ALTER TABLE complaints REPLICA IDENTITY FULL;

-- Add complaints to the supabase_realtime publication so that
-- postgres_changes subscriptions actually receive events.
-- (Safe to run even if already added — DO NOTHING on conflict.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'complaints'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
  END IF;
END;
$$;

-- ============================================================
-- 2. RLS POLICY — Allow authenticated users to read complaint
--    locations for the public civic map.
--
--    Only complaints that carry GPS coordinates are exposed.
--    Existing policies (citizens see own, dept admins see dept,
--    super admins see all) are ORed with this policy automatically
--    by Postgres.  The minimum set of fields shown on the map
--    (title, status, priority, category, landmark, lat/lng) does
--    NOT expose any PII — citizen_id is never returned by the
--    /api/complaints/nearby endpoint.
-- ============================================================

-- Drop if re-running this migration
DROP POLICY IF EXISTS "complaints_select_location_for_map" ON complaints;

CREATE POLICY "complaints_select_location_for_map"
  ON complaints
  FOR SELECT
  TO authenticated
  USING (
    latitude  IS NOT NULL
    AND longitude IS NOT NULL
  );

-- ============================================================
-- 3. FAST SPATIAL LOOKUP — Haversine-based RPC function
--
--    Optional but recommended: lets you call
--    supabase.rpc('get_nearby_complaints', {...})
--    directly instead of fetching all rows and filtering in JS.
--    The API route /api/complaints/nearby already does the
--    filtering server-side, but this function can be used for
--    future optimisation (e.g. server actions, edge functions).
-- ============================================================

CREATE OR REPLACE FUNCTION get_nearby_complaints(
  user_lat     FLOAT,
  user_lng     FLOAT,
  radius_m     FLOAT DEFAULT 500,
  dept_id      UUID  DEFAULT NULL
)
RETURNS TABLE (
  id                UUID,
  title             TEXT,
  status            complaint_status,
  priority          priority_level,
  category          TEXT,
  latitude          FLOAT,
  longitude         FLOAT,
  address_landmark  TEXT,
  created_at        TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER   -- bypasses RLS so all civic complaints are visible
AS $$
  SELECT
    c.id,
    c.title,
    c.status,
    c.priority,
    c.category,
    c.latitude,
    c.longitude,
    c.address_landmark,
    c.created_at
  FROM complaints c
  WHERE
    c.latitude  IS NOT NULL
    AND c.longitude IS NOT NULL
    -- Radius filter (Haversine approximation in metres)
    AND (
      dept_id IS NOT NULL            -- admin mode: skip radius, filter by dept
      OR (
        6371000 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((c.latitude  - user_lat) / 2)), 2) +
            COS(RADIANS(user_lat)) *
            COS(RADIANS(c.latitude)) *
            POWER(SIN(RADIANS((c.longitude - user_lng) / 2)), 2)
          )
        ) <= radius_m
      )
    )
    -- Department filter (admin mode)
    AND (dept_id IS NULL OR c.department_id = dept_id)
  ORDER BY c.created_at DESC;
$$;

-- Grant access to authenticated users and the service role
GRANT EXECUTE ON FUNCTION get_nearby_complaints(FLOAT, FLOAT, FLOAT, UUID)
  TO authenticated, service_role;

-- ============================================================
-- 4. SPATIAL INDEX for faster bounding-box pre-filter
--    (works without PostGIS — uses a composite btree index
--     on lat/lng so Postgres can quickly eliminate rows with
--     coordinates outside the rough bounding box before
--     computing the precise Haversine distance in app code).
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_complaints_lat_lng
  ON complaints (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
