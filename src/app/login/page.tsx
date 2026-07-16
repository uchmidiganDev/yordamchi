"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../auth.module.css";

type StartResponse = { token: string; deepLink: string };
type StatusResponse = { status: string };

function TelegramIcon() {
  return (
    <svg
      className={styles.tgIcon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export default function LoginPage() {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "expired" | "error">(
    "idle"
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startLogin() {
    setState("pending");
    const res = await fetch("/api/auth/telegram/start", { method: "POST" });
    const data: StartResponse = await res.json();
    setDeepLink(data.deepLink);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const statusRes = await fetch(
        `/api/auth/telegram/status?token=${data.token}`
      );
      const statusData: StatusResponse = await statusRes.json();

      if (statusData.status === "confirmed") {
        if (pollRef.current) clearInterval(pollRef.current);
        window.location.href = "/";
      } else if (
        statusData.status === "expired" ||
        statusData.status === "not_found"
      ) {
        if (pollRef.current) clearInterval(pollRef.current);
        setState("expired");
      }
    }, 2000);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>Y</div>

        {state === "idle" && (
          <>
            <h1 className={styles.title}>Yordamchi&apos;ga xush kelibsiz</h1>
            <p className={styles.subtitle}>
              Shaxsiy maqsad-vazifa boshqaruv platformasi. Kirish faqat Telegram
              orqali amalga oshiriladi.
            </p>
            <button
              onClick={startLogin}
              className={`${styles.button} ${styles.buttonTelegram}`}
            >
              <TelegramIcon />
              Telegram orqali kirish
            </button>
          </>
        )}

        {state === "pending" && (
          <>
            <h1 className={styles.title}>Tasdiqlashni kuting</h1>
            <p className={styles.subtitle}>
              Telegram ochilib, botda <b>Start</b> tugmasini bosing. Tasdiqlansa,
              avtomatik kirasiz.
            </p>
            <div className={styles.pending}>
              {deepLink && (
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.deepLink}
                >
                  <TelegramIcon />
                  Telegram botni ochish
                </a>
              )}
              <div className={styles.statusRow}>
                <span className={styles.spinner} />
                Tasdiqlanishi tekshirilmoqda…
              </div>
              <p className={styles.hint}>
                Telegram o&apos;zi ochilmasa, yuqoridagi tugmani bosing.
              </p>
            </div>
          </>
        )}

        {state === "expired" && (
          <>
            <div className={`${styles.badge} ${styles.badgeExpired}`}>⏱</div>
            <h1 className={styles.title}>Havola muddati tugadi</h1>
            <p className={styles.subtitle}>
              Xavfsizlik uchun kirish havolasi vaqtinchalik. Iltimos, qaytadan
              urinib ko&apos;ring.
            </p>
            <div className={styles.expiredBox}>
              <button
                onClick={startLogin}
                className={`${styles.button} ${styles.buttonSecondary}`}
              >
                Qayta urinish
              </button>
            </div>
          </>
        )}

        <div className={styles.footer}>
          <span className={styles.lock}>🔒</span>
          Xavfsiz Telegram autentifikatsiyasi
        </div>
      </div>
    </main>
  );
}
