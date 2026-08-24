-- ============================================================
-- Jam City - Recovery Phrase
-- Stores only a hash of the user's recovery phrase
-- ============================================================

alter table public.profiles
add column if not exists recovery_phrase_hash text;

create index if not exists profiles_username_idx
on public.profiles (username);