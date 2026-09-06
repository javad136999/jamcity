"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MarketPrice = {
  symbol: string;
  name_fa: string;
  category: string;
  price: number;
  unit: string | null;
  change_value: number;
  change_percent: number;
  is_up: boolean;
  updated_at: string;
};

const ICON_MAP: Record<string, string> = {
  gold_ons: "🪙",
  gold_18: "✨",
  coin_emami: "🪙",
  usd: "💵",
  brent_oil: "🛢️",
  tether: "₮",
  bitcoin: "₿",
};

// ترتیب نمایش؛ "brent_oil" فقط وقتی نشان داده می‌شود که در جدول market_prices
// رکوردی برایش ذخیره شده باشد (فعلاً پابرجا نیست، توضیح در fetch-market-prices.js)
const DISPLAY_ORDER = [
  "usd",
  "gold_ons",
  "gold_18",
  "coin_emami",
  "brent_oil",
  "tether",
  "bitcoin",
];

function formatPrice(value: number) {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

function formatPercent(value: number) {
  const abs = Math.abs(value);
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(abs);
}

function MarketCardSkeleton() {
  return (
    <div className="flex h-[86px] w-[142px] shrink-0 animate-pulse flex-col justify-between rounded-2xl border border-[#F0D6D6] bg-white p-3">
      <div className="h-2.5 w-2/3 rounded-full bg-[#F3E7E7]" />
      <div className="h-3.5 w-4/5 rounded-full bg-[#F3E7E7]" />
      <div className="h-2.5 w-1/2 rounded-full bg-[#F3E7E7]" />
    </div>
  );
}

export default function MarketTicker() {
  const supabase = createClient();
  const [prices, setPrices] = useState<MarketPrice[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.from("market_prices").select("*");

      if (error) {
        console.error("market prices load error", error);
        if (!cancelled) setPrices([]);
        return;
      }

      if (!cancelled) setPrices((data as MarketPrice[]) ?? []);
    }

    load();

    const channel = supabase
      .channel("market-prices-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_prices" },
        (payload) => {
          setPrices((prev) => {
            const list = prev ? [...prev] : [];
            const updated = payload.new as MarketPrice;
            const index = list.findIndex((p) => p.symbol === updated.symbol);
            if (index >= 0) {
              list[index] = updated;
            } else {
              list.push(updated);
            }
            return list;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ordered = DISPLAY_ORDER.map((symbol) =>
    (prices ?? []).find((p) => p.symbol === symbol)
  ).filter((p): p is MarketPrice => Boolean(p));

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#F5D9D9] bg-white px-3 py-3.5 shadow-[0_0_0_1px_rgba(255,45,85,.06),0_10px_28px_rgba(20,20,20,.05)] sm:px-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="jam-market-icon-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FDEBEC] text-base">
          📈
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-black text-[#1D2B1F] sm:text-[15px]">
            شاخص‌های بازار
          </h2>
          <p className="flex items-center gap-1.5 text-[9px] font-bold text-[#8A968C]">
            <span className="flex items-center gap-1 text-[#c9184a]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff2d55]" />
              زنده
            </span>
            · طلا، ارز، نفت و ارز دیجیتال
          </p>
        </div>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {prices === null ? (
          <>
            <MarketCardSkeleton />
            <MarketCardSkeleton />
            <MarketCardSkeleton />
            <MarketCardSkeleton />
          </>
        ) : ordered.length === 0 ? (
          <p className="py-4 text-[11px] text-[#8A968C]">
            فعلاً قیمتی ثبت نشده. کمی بعد دوباره سر بزنید.
          </p>
        ) : (
          ordered.map((item) => (
            <div
              key={item.symbol}
              className="jam-market-card-glow flex h-[86px] w-[142px] shrink-0 flex-col justify-between rounded-2xl border border-[#ff2d55]/40 bg-white p-3"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[13px]">{ICON_MAP[item.symbol] || "💠"}</span>
                <span className="truncate text-[10.5px] font-black text-[#1D2B1F]">
                  {item.name_fa}
                </span>
              </div>

              <p className="truncate text-[13px] font-black text-[#1D2B1F]">
                {formatPrice(item.price)}
                {item.unit && (
                  <span className="mr-1 text-[9px] font-bold text-[#8A968C]">
                    {item.unit}
                  </span>
                )}
              </p>

              <p
                className={`flex items-center gap-1 text-[10px] font-bold ${
                  item.is_up ? "text-[#147A4B]" : "text-[#E2574C]"
                }`}
              >
                <span>{item.is_up ? "▲" : "▼"}</span>
                <span>{formatPercent(item.change_percent)}٪</span>
              </p>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        @keyframes jamMarketCardGlow {
          0%, 100% {
            box-shadow: 0 0 8px 1px rgba(255, 45, 85, 0.35),
              0 0 0 1px rgba(255, 45, 85, 0.25);
          }
          50% {
            box-shadow: 0 0 18px 4px rgba(255, 45, 85, 0.65),
              0 0 0 1px rgba(255, 45, 85, 0.45);
          }
        }
        .jam-market-card-glow {
          animation: jamMarketCardGlow 2.4s ease-in-out infinite;
        }

        @keyframes jamMarketIconGlow {
          0%, 100% {
            box-shadow: 0 0 6px 1px rgba(255, 45, 85, 0.3);
          }
          50% {
            box-shadow: 0 0 14px 3px rgba(255, 45, 85, 0.55);
          }
        }
        .jam-market-icon-glow {
          animation: jamMarketIconGlow 2.4s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
