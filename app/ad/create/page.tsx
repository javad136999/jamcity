"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { AD_CATEGORIES } from "@/lib/constants";
import { uploadImages } from "@/lib/upload";
import { ErrorState } from "@/components/Feedback";

export default function CreateAdPage() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(AD_CATEGORIES[0].slug);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("active");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []).slice(0, 6);
    setFiles(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!title.trim() || !description.trim() || !region.trim()) {
      setError("عنوان، توضیحات و منطقه الزامی است.");
      return;
    }

    setLoading(true);
    try {
      const images = files.length ? await uploadImages(files, "ad-images", user.id) : [];

      const { data, error: insertError } = await supabase
        .from("ads")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          price: price ? Number(price) : null,
          category,
          region: region.trim(),
          phone: phone.trim() || null,
          status: status as "active" | "reserved" | "sold" | "expired",
          images,
        })
        .select("id")
        .single();

      if (insertError || !data) throw insertError;

      router.replace(`/ad/${data.id}`);
    } catch {
      setError("ثبت آگهی با خطا مواجه شد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">ثبت آگهی جدید</h1>
        <p className="text-sm text-slate-400">آگهی خود را برای دیوار جم ثبت کنید</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        {error && <ErrorState message={error} />}

        <div className="space-y-1">
          <label className="text-xs text-slate-500">عنوان آگهی</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            placeholder="مثلاً پژو ۲۰۶ مدل ۹۸"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">دسته‌بندی</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            >
              {AD_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug} className="bg-white">
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">وضعیت</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            >
              <option value="active" className="bg-white">فعال</option>
              <option value="reserved" className="bg-white">رزرو شده</option>
              <option value="sold" className="bg-white">فروخته شده</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">توضیحات</label>
          <textarea
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            placeholder="توضیح کامل آگهی..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">قیمت (تومان)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
              placeholder="خالی = توافقی"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">منطقه / محله</label>
            <input
              required
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
              placeholder="مثلاً بلوار امام"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">شماره تماس</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            placeholder="09xxxxxxxxx"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-500">تصاویر (حداکثر ۶ عکس)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="w-full rounded-xl2 border border-dashed border-white/20 bg-white px-4 py-6 text-sm text-slate-500"
          />
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {previews.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p} alt="preview" className="h-24 w-full rounded-xl2 object-cover" />
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-slate-800 shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "در حال ثبت..." : "ثبت آگهی"}
        </button>
      </form>
    </div>
  );
}
