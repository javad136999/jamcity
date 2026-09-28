import { cookies } from "next/headers";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { canonicalCitySlug } from "@/lib/cities";

export async function getRequestCityId(supabase: SupabaseClient<Database>): Promise<string> {
  const middlewareCityId = headers().get("x-jamcity-city-id");
  if (middlewareCityId) return middlewareCityId;

  const cookieStore = cookies();
  const cityIdCookie = cookieStore.get("jamcity_city_id")?.value;
  const citySlugCookie = cookieStore.get("jamcity_city_slug")?.value;

  // The middleware writes these cookies only after resolving an active city.
  // Trusting this display-scope value avoids an extra round-trip on each detail page.
  if (cityIdCookie) return cityIdCookie;

  if (citySlugCookie) {
    const { data } = await supabase.from("cities").select("id").eq("slug", canonicalCitySlug(citySlugCookie)).eq("is_active", true).maybeSingle();
    if (data?.id) return data.id;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("city_id").eq("id", user.id).maybeSingle();
    if (profile?.city_id) return profile.city_id;
  }

  const { data: jam } = await supabase.from("cities").select("id").eq("slug", "jam").maybeSingle();
  return jam?.id ?? "";
}
