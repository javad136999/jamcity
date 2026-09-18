"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { businessCategoryLabel, formatPrice } from "@/lib/constants";
import { uploadImages } from "@/lib/upload";
import { Spinner, ErrorState } from "@/components/Feedback";

const CAR_DEALER_CATEGORY = "car_dealer";
const SHOES_BAGS_CATEGORY = "shoes";

type Business = {
  id: string;
  owner_id: string;
  name: string;
  icon: string;
  category: string;
  subscription_status: string;
  subscription_tier: string | null;
};

type Product = {
  id: string;
  business_id: string;
  name: string;
  price: number | null;
  description: string | null;
  image_url: string | null;
  discount_percent: number | null;
};

type Vehicle = {
  id: string;
  business_id: string;
  brand: string;
  model: string;
  year: number | null;
  mileage_km: number | null;
  price: number | null;
  color: string | null;
  image_url: string | null;
  is_sold: boolean;
};

type Footwear = {
  id: string;
  business_id: string;
  product_type: "کیف" | "کفش";
  brand: string;
  size: string | null;
  color: string | null;
  material: string | null;
  price: number | null;
  stock_quantity: number | null;
  image_urls: string[];
};

export default function BusinessProductsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const id = params?.id;

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [footwear, setFootwear] = useState<Footwear[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [vehiclePrice, setVehiclePrice] = useState("");
  const [color, setColor] = useState("");
  const [vehicleImage, setVehicleImage] = useState<File | null>(null);
  const [vehicleSaving, setVehicleSaving] = useState(false);

  const [footType, setFootType] = useState<"کفش" | "کیف">("کفش");
  const [footBrand, setFootBrand] = useState("");
  const [footSize, setFootSize] = useState("");
  const [footColor, setFootColor] = useState("");
  const [footMaterial, setFootMaterial] = useState("");
  const [footPrice, setFootPrice] = useState("");
  const [footStock, setFootStock] = useState("");
  const [footImages, setFootImages] = useState<File[]>([]);
  const [footSaving, setFootSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: businessError } = await supabase
        .from("businesses")
        .select("id,owner_id,name,icon,category,subscription_status,subscription_tier")
        .eq("id", id)
        .eq("owner_id", currentUser.id)
        .maybeSingle();
      if (cancelled) return;
      if (businessError || !data) {
        setError("این کسب‌وکار پیدا نشد یا دسترسی مدیریت آن برای شما فعال نیست.");
        setLoading(false);
        return;
      }
      if (data.subscription_status !== "approved") {
        setError("مدیریت منو و محصولات فقط برای کسب‌وکارهای تاییدشده فعال است.");
        setLoading(false);
        return;
      }
      setBusiness(data as Business);
      if (data.category === CAR_DEALER_CATEGORY) {
        const { data: rows } = await supabase.from("vehicle_listings").select("*").eq("business_id", id).order("created_at", { ascending: false });
        if (!cancelled) setVehicles((rows ?? []) as Vehicle[]);
      } else if (data.category === SHOES_BAGS_CATEGORY) {
        const { data: rows } = await supabase.from("footwear_bag_listings").select("*").eq("business_id", id).order("created_at", { ascending: false });
        if (!cancelled) setFootwear((rows ?? []) as Footwear[]);
      } else {
        const { data: rows } = await supabase.from("business_products").select("*").eq("business_id", id).order("created_at", { ascending: false });
        if (!cancelled) setProducts((rows ?? []) as Product[]);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [authLoading, user, id, supabase]);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !business || !name.trim()) return;
    setSaving(true); setError(null);
    try {
      let image_url: string | null = null;
      if (image) [image_url] = await uploadImages([image], "product-images", user.id);
      const { data, error: insertError } = await supabase.from("business_products").insert({
        business_id: business.id, name: name.trim(), price: price ? Number(price) : null,
        description: description.trim() || null, image_url
      }).select("*").single();
      if (insertError || !data) throw insertError;
      setProducts(prev => [data as Product, ...prev]);
      setName(""); setPrice(""); setDescription(""); setImage(null);
    } catch { setError("افزودن محصول با خطا مواجه شد."); }
    finally { setSaving(false); }
  }

  async function deleteProduct(productId: string) {
    await supabase.from("business_products").delete().eq("id", productId).eq("business_id", id);
    setProducts(prev => prev.filter(p => p.id !== productId));
  }

  async function saveDiscount(productId: string, value: number | null) {
    await supabase.from("business_products").update({ discount_percent: value }).eq("id", productId).eq("business_id", id);
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !business || !brand.trim() || !model.trim()) return;
    setVehicleSaving(true); setError(null);
    try {
      let image_url: string | null = null;
      if (vehicleImage) [image_url] = await uploadImages([vehicleImage], "product-images", user.id);
      const { data, error: insertError } = await supabase.from("vehicle_listings").insert({
        business_id: business.id, brand: brand.trim(), model: model.trim(),
        year: year ? Number(year) : null, mileage_km: mileage ? Number(mileage) : null,
        price: vehiclePrice ? Number(vehiclePrice) : null, color: color.trim() || null, image_url
      }).select("*").single();
      if (insertError || !data) throw insertError;
      setVehicles(prev => [data as Vehicle, ...prev]);
      setBrand(""); setModel(""); setYear(""); setMileage(""); setVehiclePrice(""); setColor(""); setVehicleImage(null);
    } catch { setError("افزودن خودرو با خطا مواجه شد."); }
    finally { setVehicleSaving(false); }
  }

  async function deleteVehicle(vehicleId: string) {
    await supabase.from("vehicle_listings").delete().eq("id", vehicleId).eq("business_id", id);
    setVehicles(prev => prev.filter(v => v.id !== vehicleId));
  }

  async function toggleSold(vehicleId: string, sold: boolean) {
    await supabase.from("vehicle_listings").update({ is_sold: sold }).eq("id", vehicleId).eq("business_id", id);
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, is_sold: sold } : v));
  }

  async function addFootwear(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !business || !footBrand.trim()) return;
    setFootSaving(true); setError(null);
    try {
      const image_urls = footImages.length ? await uploadImages(footImages, "product-images", user.id) : [];
      const { data, error: insertError } = await supabase.from("footwear_bag_listings").insert({
        business_id: business.id, product_type: footType, brand: footBrand.trim(),
        size: footSize.trim() || null, color: footColor.trim() || null,
        material: footMaterial.trim() || null, price: footPrice ? Number(footPrice) : null,
        stock_quantity: footStock ? Number(footStock) : null, image_urls
      }).select("*").single();
      if (insertError || !data) throw insertError;
      setFootwear(prev => [data as Footwear, ...prev]);
      setFootType("کفش"); setFootBrand(""); setFootSize(""); setFootColor(""); setFootMaterial(""); setFootPrice(""); setFootStock(""); setFootImages([]);
    } catch { setError("افزودن محصول با خطا مواجه شد."); }
    finally { setFootSaving(false); }
  }

  async function deleteFootwear(itemId: string) {
    await supabase.from("footwear_bag_listings").delete().eq("id", itemId).eq("business_id", id);
    setFootwear(prev => prev.filter(f => f.id !== itemId));
  }

  async function saveStock(itemId: string, stock: number | null) {
    await supabase.from("footwear_bag_listings").update({ stock_quantity: stock }).eq("id", itemId).eq("business_id", id);
  }

  if (authLoading || loading) return <div className="min-h-[70vh] flex items-center justify-center"><Spinner label="در حال بارگذاری منوی کسب‌وکار..." /></div>;
  if (!user) return <div dir="rtl" className="mx-auto max-w-xl p-5 text-center"><p className="rounded-2xl bg-white p-6">برای مدیریت محصولات ابتدا وارد حساب شوید.</p></div>;
  if (!business) return <div dir="rtl" className="mx-auto max-w-xl p-5"><ErrorState message={error ?? "کسب‌وکار در دسترس نیست."} /></div>;

  const isCarDealer = business.category === CAR_DEALER_CATEGORY;
  const isShoeStore = business.category === SHOES_BAGS_CATEGORY;

  return <div dir="rtl" className="min-h-[70vh] bg-gradient-to-b from-emerald-50 via-white to-slate-50">
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 rounded-[24px] bg-white p-5 shadow-[0_8px_30px_-12px_rgba(16,185,129,.25)] ring-1 ring-emerald-100">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-emerald-600">مدیریت اختصاصی کسب‌وکار</p>
          <h1 className="mt-1 truncate text-xl font-black text-slate-800">🏪 {business.name}</h1>
          <p className="mt-1 text-[10px] text-slate-500">{businessCategoryLabel(business.category)}</p>
        </div>
        <Link href="/business/manage" className="shrink-0 rounded-xl2 border border-emerald-200 bg-white px-3 py-2 text-[10px] font-bold text-emerald-700">← پنل کسب‌وکار</Link>
      </div>

      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-slate-800">📋 منو و محصولات</h2>
        <p className="mt-1 text-[10px] text-slate-500">محصولات و خدمات این کسب‌وکار را از این صفحه مدیریت کنید.</p>
      </div>

      {error && <ErrorState message={error} />}

      {!isCarDealer && !isShoeStore && <section className="space-y-4 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-emerald-100">
        <form onSubmit={addProduct} className="grid gap-3 sm:grid-cols-2">
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="نام محصول یا خدمت" className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-emerald-400" />
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="قیمت (تومان)" className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:border-emerald-400" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="توضیح کوتاه (اختیاری)" className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white sm:col-span-2" />
          <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] ?? null)} className="rounded-xl2 border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:col-span-2" />
          <button disabled={saving} className="rounded-xl2 bg-gradient-to-l from-jam-green to-emerald-400 py-3 text-sm font-bold text-white sm:col-span-2">{saving ? "در حال افزودن..." : "+ افزودن محصول"}</button>
        </form>
        <ProductGrid products={products} onDelete={deleteProduct} onDiscount={saveDiscount} />
      </section>}

      {isCarDealer && <section className="space-y-4 rounded-[24px] border border-[#E7D9B8] bg-gradient-to-b from-white to-[#FBF7EE] p-5 shadow-sm">
        <h2 className="text-base font-black">🚗 ماشین‌های نمایشگاه</h2>
        <form onSubmit={addVehicle} className="grid gap-3 sm:grid-cols-2">
          <input required value={brand} onChange={e => setBrand(e.target.value)} placeholder="برند" className="field" />
          <input required value={model} onChange={e => setModel(e.target.value)} placeholder="مدل" className="field" />
          <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="سال ساخت" className="field" />
          <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} placeholder="کارکرد (کیلومتر)" className="field" />
          <input value={color} onChange={e => setColor(e.target.value)} placeholder="رنگ" className="field" />
          <input type="number" value={vehiclePrice} onChange={e => setVehiclePrice(e.target.value)} placeholder="قیمت (تومان)" className="field" />
          <input type="file" accept="image/*" onChange={e => setVehicleImage(e.target.files?.[0] ?? null)} className="field sm:col-span-2" />
          <button disabled={vehicleSaving} className="rounded-xl2 bg-gradient-to-l from-[#D98F2B] to-[#B8721E] py-3 text-sm font-bold text-white sm:col-span-2">{vehicleSaving ? "در حال افزودن..." : "+ افزودن خودرو"}</button>
        </form>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map(v => <div key={v.id} className="overflow-hidden rounded-2xl border bg-white">
          <div className="h-32 bg-slate-100">{v.image_url ? <img src={v.image_url} alt={v.model} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl">🚗</div>}</div>
          <div className="space-y-1.5 p-3"><p className="font-black">{v.brand} {v.model}</p><p className="text-xs text-slate-500">{v.year ?? ""} {v.mileage_km !== null ? "• "+new Intl.NumberFormat("fa-IR").format(v.mileage_km)+" کیلومتر" : ""}</p>{v.price !== null && <p className="font-black text-emerald-700">{formatPrice(v.price)}</p>}<div className="flex gap-2 pt-1"><button onClick={() => toggleSold(v.id,!v.is_sold)} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px]">{v.is_sold ? "موجود" : "فروخته شد"}</button><button onClick={() => deleteVehicle(v.id)} className="mr-auto text-[10px] font-bold text-red-500">حذف</button></div></div>
        </div>)}</div>
      </section>}

      {isShoeStore && <section className="space-y-4 rounded-[24px] border border-[#F0D9E8] bg-gradient-to-b from-white to-[#FDF4F8] p-5 shadow-sm">
        <h2 className="text-base font-black">👟 محصولات کیف و کفش</h2>
        <form onSubmit={addFootwear} className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-2 sm:col-span-2"><button type="button" onClick={() => setFootType("کفش")} className={footType==="کفش" ? "flex-1 rounded-xl2 bg-[#8A2F58] py-3 text-sm font-bold text-white" : "flex-1 rounded-xl2 border py-3 text-sm font-bold"}>👟 کفش</button><button type="button" onClick={() => setFootType("کیف")} className={footType==="کیف" ? "flex-1 rounded-xl2 bg-[#8A2F58] py-3 text-sm font-bold text-white" : "flex-1 rounded-xl2 border py-3 text-sm font-bold"}>👜 کیف</button></div>
          <input required value={footBrand} onChange={e => setFootBrand(e.target.value)} placeholder="برند" className="field" />
          <input value={footSize} onChange={e => setFootSize(e.target.value)} placeholder="سایز" className="field" />
          <input value={footColor} onChange={e => setFootColor(e.target.value)} placeholder="رنگ" className="field" />
          <input value={footMaterial} onChange={e => setFootMaterial(e.target.value)} placeholder="جنس" className="field" />
          <input type="number" value={footPrice} onChange={e => setFootPrice(e.target.value)} placeholder="قیمت (تومان)" className="field" />
          <input type="number" min={0} value={footStock} onChange={e => setFootStock(e.target.value)} placeholder="موجودی" className="field" />
          <input type="file" accept="image/*" multiple onChange={e => setFootImages(e.target.files ? Array.from(e.target.files) : [])} className="field sm:col-span-2" />
          <button disabled={footSaving} className="rounded-xl2 bg-gradient-to-l from-[#C2447A] to-[#8A2F58] py-3 text-sm font-bold text-white sm:col-span-2">{footSaving ? "در حال افزودن..." : "+ افزودن محصول"}</button>
        </form>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{footwear.map(f => <div key={f.id} className="overflow-hidden rounded-2xl border bg-white"><div className="h-32 bg-slate-100">{f.image_urls?.[0] ? <img src={f.image_urls[0]} alt={f.brand} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl">{f.product_type==="کفش"?"👟":"👜"}</div>}</div><div className="space-y-1.5 p-3"><p className="font-black">{f.product_type==="کفش"?"👟":"👜"} {f.brand}</p><p className="text-xs text-slate-500">{f.size ?? ""} {f.color ? "• "+f.color : ""}</p>{f.price !== null && <p className="font-black text-emerald-700">{formatPrice(f.price)}</p>}<div className="flex items-center gap-2"><input type="number" min={0} value={f.stock_quantity ?? ""} onChange={e => setFootwear(prev => prev.map(x => x.id===f.id ? {...x,stock_quantity:e.target.value===""?null:Number(e.target.value)}:x))} className="w-20 rounded-lg border px-2 py-1 text-xs" placeholder="موجودی" /><button onClick={() => saveStock(f.id,f.stock_quantity)} className="rounded-lg bg-[#8A2F58] px-2 py-1 text-[10px] font-bold text-white">ذخیره</button><button onClick={() => deleteFootwear(f.id)} className="mr-auto text-[10px] font-bold text-red-500">حذف</button></div></div></div>)}</div>
      </section>}
    </div>
    <style jsx>{`
      .field { width:100%; border-radius:0.75rem; border:1px solid rgb(226 232 240); background:rgb(248 250 252); padding:0.75rem 1rem; font-size:0.875rem; outline:none; }
      .field:focus { background:white; border-color:rgb(52 211 153); }
    `}</style>
  </div>;
}

function ProductGrid({ products, onDelete, onDiscount }: { products: Product[]; onDelete: (id:string)=>void; onDiscount:(id:string,value:number|null)=>void }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {products.map(p => <div key={p.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      {p.image_url && <img src={p.image_url} alt={p.name} className="h-32 w-full object-cover" />}
      <div className="space-y-2 p-3">
        <p className="font-bold text-slate-800">{p.name}</p>
        {p.price !== null && <p className="text-sm font-black text-emerald-700">{formatPrice(p.price)}</p>}
        {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-2">
          <span className="text-xs font-bold text-red-500">🏷️ تخفیف</span>
          <input type="number" min={0} max={100} value={p.discount_percent ?? ""} onChange={e => { const value=e.target.value===""?null:Number(e.target.value); p.discount_percent=value; }} placeholder="٪" className="w-14 rounded-lg border bg-white px-2 py-1 text-xs" />
          <button onClick={() => onDiscount(p.id,p.discount_percent)} className="mr-auto rounded-lg bg-red-500 px-2 py-1 text-[10px] font-bold text-white">ذخیره</button>
        </div>
        <button onClick={() => onDelete(p.id)} className="text-xs font-bold text-red-500">حذف</button>
      </div>
    </div>)}
  </div>;
}
