"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/Feedback";

export default function RegisterPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          phone,
          password,
          recoveryPhrase,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "╪½╪¿╪¬ΓÇî┘å╪º┘à ╪º┘å╪¼╪º┘à ┘å╪┤╪».");
        return;
      }

      router.push("/login");
    } catch {
      setError("╪«╪╖╪º█î█î ╪▒╪« ╪»╪º╪». ╪»┘ê╪¿╪º╪▒┘ç ╪¬┘ä╪º╪┤ ┌⌐┘å█î╪».");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="fade-in mx-auto flex max-w-md flex-col gap-6 py-10"
    >
      <div className="text-center">
        <span className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-jam-green to-jam-darkgreen text-3xl font-bold text-white shadow-glow">
          ╪¼
        </span>

        <h1 className="text-2xl font-extrabold text-slate-800">
          ╪│╪º╪«╪¬ ╪¡╪│╪º╪¿ ╪»╪▒ ╪┤┘ç╪▒ ╪¼┘à
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          ╪º╪╖┘ä╪º╪╣╪º╪¬ ╪«┘ê╪» ╪▒╪º ╪¿╪▒╪º█î ╪│╪º╪«╪¬ ╪¡╪│╪º╪¿ ┘ê╪º╪▒╪» ┌⌐┘å█î╪»
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl2 glass p-6 shadow-soft"
      >
        {error && <ErrorState message={error} />}

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">
            ┘å╪º┘à ┘å┘à╪º█î╪┤█î
          </label>

          <input
            type="text"
            required
            minLength={2}
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="┘à╪½┘ä╪º┘ï ╪╣┘ä█î ╪▒╪╢╪º█î█î"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />

          <p className="text-xs leading-5 text-slate-400">
            ╪º█î┘å ┘å╪º┘à ╪»╪▒ ┘╛╪▒┘ê┘ü╪º█î┘ä╪î ┌å╪¬╪î ╪»█î┘ê╪º╪▒ ┘ê ╪ó┌»┘ç█îΓÇî┘ç╪º█î ╪┤┘à╪º ┘å┘à╪º█î╪┤ ╪»╪º╪»┘ç ┘à█îΓÇî╪┤┘ê╪».
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">
            ╪┤┘à╪º╪▒┘ç ┘à┘ê╪¿╪º█î┘ä
          </label>

          <input
            type="tel"
            required
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09123456789"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">
            ╪▒┘à╪▓ ╪╣╪¿┘ê╪▒
          </label>

          <input
            type="password"
            required
            minLength={6}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="╪¡╪»╪º┘é┘ä █╢ ┌⌐╪º╪▒╪º┌⌐╪¬╪▒"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">
            ╪╣╪¿╪º╪▒╪¬ ╪¿╪º╪▓█î╪º╪¿█î
          </label>

          <input
            type="text"
            required
            minLength={6}
            value={recoveryPhrase}
            onChange={(e) => setRecoveryPhrase(e.target.value)}
            placeholder="┘à╪½┘ä╪º┘ï ┌»┘ä ╪ó╪¿█î ╪¼┘à █▒█┤█░█╡"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />

          <p className="text-xs leading-6 text-slate-400">
            █î┌⌐ ╪╣╪¿╪º╪▒╪¬ ┘à╪«╪╡┘ê╪╡ ╪«┘ê╪»╪¬╪º┘å ╪º┘å╪¬╪«╪º╪¿ ┌⌐┘å█î╪» ┘ê ╪¡╪¬┘à╪º┘ï ╪ó┘å ╪▒╪º ╪¿┘ç ╪«╪º╪╖╪▒ ╪¿╪│┘╛╪º╪▒█î╪».
            ╪¿╪▒╪º█î ╪¿╪º╪▓█î╪º╪¿█î ╪▒┘à╪▓ ╪╣╪¿┘ê╪▒ ╪¿┘ç ╪ó┘å ┘å█î╪º╪▓ ╪«┘ê╪º┘ç█î╪» ╪»╪º╪┤╪¬.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "╪»╪▒ ╪¡╪º┘ä ╪│╪º╪«╪¬ ╪¡╪│╪º╪¿..." : "╪│╪º╪«╪¬ ╪¡╪│╪º╪¿"}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400">
        ┘é╪¿┘ä╪º┘ï ╪½╪¿╪¬ΓÇî┘å╪º┘à ┌⌐╪▒╪»┘çΓÇî╪º█î╪»╪ƒ{" "}
        <Link
          href="/login"
          className="font-bold text-jam-green hover:underline"
        >
          ┘ê╪º╪▒╪» ╪┤┘ê█î╪»
        </Link>
      </p>
    </div>
  );
}