# جم‌سیتی (JamCity)

پلتفرم شهری شهر جم — دیوار آگهی، کسب‌وکارها، نقشه و چت خصوصی Realtime.

## راه‌اندازی

### ۱. نصب پکیج‌ها
```bash
npm install
```

### ۲. ساخت پروژه Supabase
1. در [supabase.com](https://supabase.com) یک پروژه جدید بسازید.
2. در بخش **SQL Editor**، محتوای فایل `supabase/migrations/0001_init.sql` را اجرا کنید.
   این فایل تمام جدول‌ها، RLS Policyها، Storage Bucketها و Realtime Publication را می‌سازد و اجرای دوباره‌اش خطا نمی‌دهد.
3. در بخش **Authentication → Providers**، ورود با Email/Password را فعال نگه دارید.
4. آدرس Project URL و anon key را از **Project Settings → API** کپی کنید.

### ۳. متغیرهای محیطی
فایل `.env.example` را کپی کرده و به `.env.local` تغییر نام دهید، سپس مقادیر را وارد کنید:
```bash
cp .env.example .env.local
```

### ۴. اجرای پروژه
```bash
npm run dev
```
سایت روی `http://localhost:3000` بالا می‌آید.

## ساختار پروژه
```
app/            صفحات Next.js (App Router)
components/     کامپوننت‌های مشترک (Header, BottomNav, AdCard, ...)
lib/            کلاینت Supabase، Auth Context، ثابت‌ها، آپلود فایل
supabase/       فایل Migration دیتابیس
public/         مانیفست PWA و آیکون‌ها
```

## نکات مهم
- **RLS**: هر کاربر فقط می‌تواند آگهی، پروفایل و پیام‌های خودش را ویرایش/حذف کند. Policyهای کامل در فایل Migration تعریف شده‌اند.
- **Realtime**: پیام‌های چت با Supabase Realtime به‌صورت آنی نمایش داده می‌شوند.
- **PWA**: پروژه با `next-pwa` قابل نصب روی موبایل است (در محیط production فعال می‌شود).
- **نقشه**: از Leaflet + OpenStreetMap استفاده شده (بدون نیاز به API Key).
- برای این‌که آگهی‌ها یا کسب‌وکارها روی نقشه دیده شوند، باید مقادیر `lat` و `lng` هنگام ثبت مقداردهی شوند.
