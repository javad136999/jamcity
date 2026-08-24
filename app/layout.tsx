import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import VisitTracker from "@/components/VisitTracker";

export const metadata: Metadata = {
  title: "جم‌سیتی | همه‌چیز برای زندگی بهتر در جم",
  description:
    "جم‌سیتی؛ پلتفرم شهری جم برای ثبت آگهی، پیدا کردن کسب‌وکارها و خدمات شهری و گفتگو با شهروندان جم.",
  manifest: "/manifest.json",

  other: {
    enamad: "35770718",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "جم‌سیتی",
  },

  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b6e4f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="gradient-bg min-h-screen">
        <AuthProvider>
          <VisitTracker />
          <Header />

          <main className="mx-auto min-h-[70vh] max-w-6xl px-4 pb-24 pt-6 md:pb-10">
            {children}
          </main>

          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}