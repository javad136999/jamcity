"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorState } from "@/components/Feedback";

export default function AdActions({
  adId,
  sellerId,
  phone,
  isOwner,
  currentUserId,
}: {
  adId: string;
  sellerId: string;
  phone: string | null;
  isOwner: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhone, setShowPhone] = useState(false);

  async function handleMessage() {
    setError(null);
    if (!currentUserId) {
      router.push(`/login?redirect=/ad/${adId}`);
      return;
    }
    if (currentUserId === sellerId) return;

    setLoading(true);

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(user_one.eq.${currentUserId},user_two.eq.${sellerId}),and(user_one.eq.${sellerId},user_two.eq.${currentUserId})`
      )
      .eq("ad_id", adId)
      .maybeSingle();

    let conversationId = existing?.id;

    if (!conversationId) {
      const { data, error: insertError } = await supabase
        .from("conversations")
        .insert({ user_one: currentUserId, user_two: sellerId, ad_id: adId })
        .select("id")
        .single();

      if (insertError || !data) {
        setLoading(false);
        setError("امکان ایجاد گفتگو وجود نداشت.");
        return;
      }
      conversationId = data.id;
    }

    setLoading(false);
    router.push(`/chat/${conversationId}`);
  }

  async function handleSave() {
    if (!currentUserId) {
      router.push(`/login?redirect=/ad/${adId}`);
      return;
    }
    await supabase.from("favorites").upsert(
      { user_id: currentUserId, ad_id: adId },
      { onConflict: "user_id,ad_id" }
    );
    setSaved(true);
  }

  return (
    <div className="space-y-3">
      {error && <ErrorState message={error} />}
      <div className="flex flex-wrap gap-3">
        {!isOwner && (
          <>
            <button
              onClick={() => setShowPhone(true)}
              className="flex-1 rounded-xl2 bg-jam-green py-3 text-center text-sm font-bold text-slate-800 shadow-glow transition hover:brightness-110"
            >
              {showPhone && phone ? phone : "☎️ تماس"}
            </button>
            <button
              onClick={handleMessage}
              disabled={loading}
              className="flex-1 rounded-xl2 glass py-3 text-center text-sm font-bold text-slate-800 transition hover:bg-black/5 disabled:opacity-50"
            >
              💬 ارسال پیام
            </button>
            <button
              onClick={handleSave}
              className="rounded-xl2 glass px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-black/5"
            >
              {saved ? "❤️" : "🤍"}
            </button>
          </>
        )}
        {isOwner && (
          <p className="w-full rounded-xl2 border border-jam-green/30 bg-jam-green/10 px-4 py-3 text-center text-xs text-jam-green">
            این آگهی متعلق به شماست
          </p>
        )}
      </div>
    </div>
  );
}
