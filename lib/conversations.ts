import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function getOrCreateConversation(
  supabase: SupabaseClient<Database>,
  myId: string,
  otherId: string
): Promise<string | null> {
  if (myId === otherId) return null;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(user_one.eq.${myId},user_two.eq.${otherId}),and(user_one.eq.${otherId},user_two.eq.${myId})`
    )
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_one: myId, user_two: otherId })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}
