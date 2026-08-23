import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fade-in flex flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="text-5xl">🧭</span>
      <h1 className="text-xl font-bold text-slate-800">صفحه مورد نظر پیدا نشد</h1>
      <p className="text-sm text-slate-400">
        ممکن است آگهی حذف شده یا آدرس اشتباه باشد.
      </p>
      <Link
        href="/wall"
        className="rounded-xl2 bg-jam-green px-5 py-2.5 text-sm font-bold text-slate-800 shadow-glow"
      >
        بازگشت به دیوار جم
      </Link>
    </div>
  );
}
