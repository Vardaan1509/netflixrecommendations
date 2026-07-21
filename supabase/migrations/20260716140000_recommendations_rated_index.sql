-- ============================================================================
-- Schema cleanup: index the "rated history" query pattern.
--
-- get-recommendations runs, per request:
--   SELECT ... FROM recommendations
--   WHERE user_id = $1 AND user_rating IS NOT NULL
--   ORDER BY created_at DESC LIMIT 30
--
-- A partial composite index serves this exactly: scoped to one user, only the
-- rated rows, pre-sorted by recency. Small (only rated rows) and precise.
-- The existing idx_recommendations_user_id still covers the repeat-avoidance
-- lookup (all titles for a user).
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_recommendations_user_rated
  ON public.recommendations (user_id, created_at DESC)
  WHERE user_rating IS NOT NULL;
