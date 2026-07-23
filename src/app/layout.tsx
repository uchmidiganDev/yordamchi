import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { TelegramMiniApp } from "@/components/telegram-mini-app";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yordamchi",
  description: "Shaxsiy maqsad-vazifa boshqaruv platformasi",
};

// `viewportFit: "cover"` Telegram Mini App WebView'da ekranni to'liq egallash
// va env(safe-area-inset-*) qiymatlarining to'g'ri ishlashi uchun zarur.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <TelegramMiniApp />
        {children}
      </body>
    </html>
  );
}
