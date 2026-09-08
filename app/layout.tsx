import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import VisitTracker from "@/components/VisitTracker";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import InstallAppButton from "@/components/InstallAppButton";

export const metadata: Metadata = {
  title: "Ø¬Ù…â€ŒØ³ÛŒØªÛŒ | Ù‡Ù…Ù‡â€ŒÚ†ÛŒØ² Ø¨Ø±Ø§ÛŒ Ø²Ù†Ø¯Ú¯ÛŒ Ø¨Ù‡ØªØ± Ø¯Ø± Ø¬Ù…",
  description:
    "Ø¬Ù…â€ŒØ³ÛŒØªÛŒ› Ù¾Ù„ØªÙÙØ±Ù… Ø´Ù‡Ø±ÛŒ Ø¬Ù… Ø¨Ø±Ø§ÛŒ Ø«Ø¨Øª Ø¢Ú¯Ù‡ÛŒØŒ Ù¾ÛŒØ¯Ø§ Ú©Ø±Ø¯Ù† Ú©Ø³Ø¨â€ŒÙˆÚ©Ø§Ø±Ù‡Ø§ Ùˆ Ø®Ø¯Ù…Ø§Øª Ø´Ù‡Ø±ÛŒ Ùˆ Ú¯ÙÙØªÚ¯Ùˆ Ø¨Ø§ Ø´Ù‡Ø±ÙˆÙ†Ø¯Ø§Ù† Ø¬Ù…",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ø¬Ù…â€ŒØ³ÛŒØªÛŒ",
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
        <ServiceWorkerRegistration />
        <AuthProvider>
          <VisitTracker />
          <Header />
          <main className="mx-auto min-h-[70vh] max-w-6xl px-4 pb-24 pt-6 md:pb-10">
            {children}
          </main>
          <BottomNav />
          <InstallAppButton />
        </AuthProvider>
      </body>
    </html>
  );
}
