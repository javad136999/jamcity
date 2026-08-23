-- ============================================================
-- جم‌سیتی — Force PostgREST to reload its schema cache.
-- After several migrations added/changed foreign keys and columns,
-- Supabase's API layer (PostgREST) can keep serving a stale schema
-- cache until this runs (or until it auto-refreshes on its own,
-- which can take a while). This can cause embedded-relationship
-- queries (e.g. wall_messages joined with profiles) to silently
-- return nothing. Safe to run anytime, any number of times.
-- ============================================================

notify pgrst, 'reload schema';
