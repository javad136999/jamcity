"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="gradient-bg flex min-h-screen items-center justify-center px-4">
        <div className="fade-in max-w-sm space-y-4 rounded-xl2 glass p-8 text-center">
          <span className="text-4xl">⚠️</span>
          <h1 className="text-lg font-bold text-slate-800">مشکلی پیش آمد</h1>
          <p className="text-sm text-slate-400">
            خطایی غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.
          </p>
          <button
            onClick={reset}
            className="rounded-xl2 bg-jam-green px-5 py-2.5 text-sm font-bold text-slate-800 shadow-glow"
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
