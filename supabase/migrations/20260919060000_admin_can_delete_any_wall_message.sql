drop policy if exists "wall_messages_delete_own_or_admin" on public.wall_messages;

create policy "wall_messages_delete_own_or_admin"
on public.wall_messages
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_admin = true
  )
);