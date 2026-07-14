"use client";

import { useEffect, useRef, useState } from "react";

type StartResponse = { token: string; deepLink: string };
type StatusResponse = { status: string };

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
    <main style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
      <h1>Yordamchi</h1>
      <p>Ilovaga faqat Telegram orqali kirish mumkin.</p>

      {state === "idle" && (
        <button onClick={startLogin} style={{ padding: "12px 24px" }}>
          Telegram orqali kirish
        </button>
      )}

      {state === "pending" && deepLink && (
        <div>
          <p>Telegram botda tasdiqlang:</p>
          <a href={deepLink} target="_blank" rel="noreferrer">
            {deepLink}
          </a>
          <p>Kuting, tasdiqlanishi tekshirilmoqda...</p>
        </div>
      )}

      {state === "expired" && (
        <div>
          <p>Havola muddati tugadi.</p>
          <button onClick={startLogin} style={{ padding: "12px 24px" }}>
            Qayta urinish
          </button>
        </div>
      )}
    </main>
  );
}
