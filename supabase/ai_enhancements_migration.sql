-- ============================================================
-- ResolveX — AI Enhancements Migration
-- Adds:
--   1. complaints.ai_summary          (jsonb)   — structured AI analysis
--   2. resolutions.routing_was_correct (boolean) — feedback loop signal
--   3. resolutions.admin_corrected_department_id (uuid) — correction target
-- Run this in the Supabase SQL Editor AFTER the base migrations.sql
-- ============================================================

-- ── 1. complaints: add ai_summary column ─────────────────────────────────────

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS ai_summary jsonb;

COMMENT ON COLUMN public.complaints.ai_summary IS
  'Structured AI-generated analysis: one_line_summary, location_detail, '
  'department_reasoning, urgency, urgency_explanation, key_issues[], '
  'affected_scope, tags[]. Populated by the summarize pipeline step.';

-- ── 2. resolutions: routing feedback columns ──────────────────────────────────

ALTER TABLE public.resolutions
  ADD COLUMN IF NOT EXISTS routing_was_correct boolean;

COMMENT ON COLUMN public.resolutions.routing_was_correct IS
  'Admin feedback on whether the AI correctly routed the complaint. '
  'TRUE = correct, FALSE = wrong department, NULL = no feedback provided.';

ALTER TABLE public.resolutions
  ADD COLUMN IF NOT EXISTS admin_corrected_department_id uuid
    REFERENCES public.departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.resolutions.admin_corrected_department_id IS
  'If routing_was_correct = FALSE, the department the admin manually '
  'reassigned the complaint to. Used in routing accuracy analytics '
  'and is embedded into the resolution vector for better future RAG.';

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

-- Fast filter for the routing-accuracy analytics API
CREATE INDEX IF NOT EXISTS idx_resolutions_routing_feedback
  ON public.resolutions (routing_was_correct)
  WHERE routing_was_correct IS NOT NULL;

-- Allow efficient lookup of corrections by target department
CREATE INDEX IF NOT EXISTS idx_resolutions_corrected_dept
  ON public.resolutions (admin_corrected_department_id)
  WHERE admin_corrected_department_id IS NOT NULL;

-- GIN index for jsonb queries on ai_summary (e.g. filter by urgency tag)
CREATE INDEX IF NOT EXISTS idx_complaints_ai_summary
  ON public.complaints USING gin (ai_summary)
  WHERE ai_summary IS NOT NULL;

-- ── 4. Update match_resolutions to boost correctly-routed resolutions ─────────
-- Replaces the original function with an enhanced version that adds a small
-- accuracy_boost to resolutions confirmed correct by an admin.
-- The boost nudges the similarity score up by 0.05 for confirmed correct
-- routings, improving future RAG recommendation quality.

CREATE OR REPLACE FUNCTION match_resolutions(
    query_embedding  vector(768),
    match_threshold  float,
    match_count      int
)
RETURNS TABLE (
    id               UUID,
    complaint_id     UUID,
    resolution_text  TEXT,
    similarity       float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        r.id,
        r.complaint_id,
        r.resolution_text,
        -- Base cosine similarity
        LEAST(
            1.0,
            (1 - (r.resolution_embedding <=> query_embedding))
            -- Accuracy boost: +0.05 for confirmed-correct routings
            + CASE WHEN r.routing_was_correct = TRUE THEN 0.05 ELSE 0.0 END
        ) AS similarity
    FROM resolutions r
    WHERE r.resolution_embedding IS NOT NULL
      AND (1 - (r.resolution_embedding <=> query_embedding)) > match_threshold
    ORDER BY
        (r.resolution_embedding <=> query_embedding)
        -- Penalise confirmed-wrong routings slightly in sort order
        - CASE WHEN r.routing_was_correct = FALSE THEN 0.1 ELSE 0.0 END
    LIMIT match_count;
$$;

-- Re-grant execute permissions (in case the function was recreated)
GRANT EXECUTE ON FUNCTION match_resolutions TO authenticated;
GRANT EXECUTE ON FUNCTION match_resolutions TO service_role;

-- ── 5. Routing accuracy view (for super-admin analytics) ──────────────────────
-- A convenience view that joins resolution feedback with complaint + department
-- data to make analytics queries simpler.

CREATE OR REPLACE VIEW public.routing_accuracy_summary AS
SELECT
    r.id                           AS resolution_id,
    r.complaint_id,
    r.routing_was_correct,
    r.admin_corrected_department_id,
    r.resolved_at,
    c.category,
    c.priority,
    c.municipal_ward,
    c.ai_confidence_score,
    orig_dept.name                 AS ai_assigned_department,
    corr_dept.name                 AS corrected_department
FROM public.resolutions r
JOIN public.complaints c
    ON c.id = r.complaint_id
LEFT JOIN public.departments orig_dept
    ON orig_dept.id = c.department_id
LEFT JOIN public.departments corr_dept
    ON corr_dept.id = r.admin_corrected_department_id
WHERE r.routing_was_correct IS NOT NULL;

-- Grant read access to authenticated users and service role
GRANT SELECT ON public.routing_accuracy_summary TO authenticated;
GRANT SELECT ON public.routing_accuracy_summary TO service_role;
