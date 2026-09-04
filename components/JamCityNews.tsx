"use client";

export default function JamCityNews() {
 return (
  <section className="mt-3 overflow-hidden rounded-2xl border border-green-400/30 bg-[#050806] p-3 shadow-[0_0_25px_rgba(34,197,94,0.12)]">

    {/* هدر اخبار */}
    <div className="flex items-center gap-2">

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-green-400/30 bg-green-400/10 text-base shadow-[0_0_15px_rgba(34,197,94,0.25)]">
        📰
      </div>

      <div className="min-w-0 flex-1">

        <div className="flex items-center gap-2">

          <h2 className="text-sm font-black text-green-300">
            اخبار روز جم
          </h2>

          <span className="flex items-center gap-1 rounded-full border border-green-400/20 bg-green-400/10 px-2 py-0.5 text-[7px] font-bold text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_#22c55e]" />
            LIVE
          </span>

        </div>

        <p className="mt-0.5 text-[7px] text-slate-500">
          آخرین اخبار و اتفاقات مهم
        </p>

      </div>

    </div>

    {/* محتوای اخبار */}
    <div className="mt-2 max-h-[110px] overflow-hidden rounded-xl border border-green-400/10 bg-black/20 p-2">

      <div className="text-center">

        <div className="text-xl">
          📰
        </div>

        <p className="mt-1 text-[9px] font-bold text-green-200">
          مرکز اخبار جم‌سیتی
        </p>

        <p className="mt-0.5 text-[7px] text-slate-500">
          اخبار جم، اقتصاد، ایران و جهان
        </p>

      </div>

    </div>

  </section>
);
}