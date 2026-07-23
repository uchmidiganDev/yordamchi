"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  initData: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

// Ilova bosh sahifasining fon rangi (tokens.css --bg) — Telegram'ning o'z
// header/fon rangini shu bilan moslashtirish uchun.
const APP_BG = "#dfdae8";

// Ilova Telegram Mini App sifatida ochilganda bir martalik ishga tushirish:
// WebApp SDK'ni tayyorlash, initData orqali avtomatik kirish (login sahifasi
// o'rniga) va orqaga qaytish tugmasini ichki navigatsiyaga bog'lash.
export function TelegramMiniApp() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    tg.expand();
    tg.setHeaderColor?.(APP_BG);
    tg.setBackgroundColor?.(APP_BG);
    tg.disableVerticalSwipes?.();

    if (tg.initData) {
      fetch("/api/auth/telegram/webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.ok && window.location.pathname === "/login") {
            router.replace("/");
          }
        })
        .catch(() => {});
    }
    // Faqat to'liq sahifa yuklanganda bir marta ishga tushadi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;

    const isRoot = pathname === "/" || pathname === "/login";
    const goBack = () => router.back();

    if (isRoot) {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
      tg.BackButton.onClick(goBack);
    }

    return () => {
      tg.BackButton.offClick(goBack);
    };
  }, [pathname, router]);

  return null;
}
