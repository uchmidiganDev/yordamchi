"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./voice-modal.module.css";

type Status = "idle" | "listening" | "thinking" | "speaking";
type Turn = { question: string; answer: string };

const HISTORY_LIMIT = 6;

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) {
      return c;
    }
  }
  return "audio/webm";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// "Yuzma-yuz" ovozli suhbat modali: gapirasiz -> AI eshitadi (Gemini STT) ->
// javob beradi (AI Assistant) -> javobni ovozda aytadi. Klonlangan ovoz
// (ElevenLabs, ELEVENLABS_API_KEY/VOICE_ID sozlangan bo'lsa) ustuvor; hali
// sozlanmagan bo'lsa brauzerning o'z SpeechSynthesis'i bilan zaxira sifatida
// gapiradi — funksiya ElevenLabs sozlanishini kutmasdan darhol ishlaydi.
export function VoiceModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [caption, setCaption] = useState<{ question: string; answer: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function startListening() {
    setError(null);
    setCaption(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => handleRecordingStop(mimeType);
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("listening");
    } catch {
      setError("Mikrofonga ruxsat berilmadi. Telegram/brauzer sozlamalaridan ruxsat bering.");
    }
  }

  function stopListening() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function handleRecordingStop(mimeType: string) {
    setStatus("thinking");
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      setError("Telegram konteksti topilmadi.");
      setStatus("idle");
      return;
    }

    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/assistant/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          audioBase64,
          audioMimeType: mimeType,
          history: historyRef.current.slice(-HISTORY_LIMIT),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError("Javob olishda xatolik yuz berdi. Qayta urinib ko'ring.");
        setStatus("idle");
        return;
      }

      if (data.transcript) {
        historyRef.current.push({ question: data.transcript, answer: data.answer });
      }
      setCaption({ question: data.transcript || "(tushunilmadi)", answer: data.answer });
      await speak(data.answer, data.audioBase64, data.audioMimeType);
    } catch {
      setError("Javob olishda xatolik yuz berdi. Qayta urinib ko'ring.");
      setStatus("idle");
    }
  }

  function speak(
    text: string,
    audioBase64: string | null,
    audioMimeType: string | null
  ): Promise<void> {
    return new Promise((resolve) => {
      setStatus("speaking");

      if (audioBase64 && audioMimeType) {
        const audio = new Audio(`data:${audioMimeType};base64,${audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => {
          setStatus("idle");
          resolve();
        };
        audio.onerror = () => {
          setStatus("idle");
          resolve();
        };
        audio.play().catch(() => {
          setStatus("idle");
          resolve();
        });
        return;
      }

      if (typeof window.speechSynthesis !== "undefined") {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
          setStatus("idle");
          resolve();
        };
        utterance.onerror = () => {
          setStatus("idle");
          resolve();
        };
        window.speechSynthesis.speak(utterance);
        return;
      }

      setStatus("idle");
      resolve();
    });
  }

  function handleMicClick() {
    if (status === "listening") {
      stopListening();
    } else if (status === "idle") {
      startListening();
    }
  }

  const avatarClass =
    status === "listening"
      ? styles.avatarListening
      : status === "thinking"
        ? styles.avatarThinking
        : status === "speaking"
          ? styles.avatarSpeaking
          : styles.avatarIdle;

  const statusLabel =
    status === "listening"
      ? "Tinglayapman…"
      : status === "thinking"
        ? "O'ylayapman…"
        : status === "speaking"
          ? "Gapiryapman…"
          : "Gapirish uchun bosing";

  return (
    <div className={styles.overlay}>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Yopish">
        ✕
      </button>

      <div className={styles.center}>
        <div className={`${styles.avatar} ${avatarClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ai-avatar.png" alt="AI yordamchi" className={styles.avatarImg} />
          {status === "speaking" && (
            <div className={styles.mouthDots}>
              <span className={styles.mouthDot} />
              <span className={styles.mouthDot} />
              <span className={styles.mouthDot} />
            </div>
          )}
        </div>
        <div className={styles.status}>{statusLabel}</div>
        {error && <div className={styles.error}>{error}</div>}
        {caption && !error && (
          <div className={styles.caption}>
            <div>&ldquo;{caption.question}&rdquo;</div>
            <div className={styles.captionAnswer}>{caption.answer}</div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button
          className={`${styles.micBtn} ${status === "listening" ? styles.micBtnListening : ""}`}
          onClick={handleMicClick}
          disabled={status === "thinking" || status === "speaking"}
          aria-label={status === "listening" ? "To'xtatish" : "Gapirish"}
        >
          {status === "listening" ? "■" : "🎤"}
        </button>
        <div className={styles.hint}>
          {status === "listening"
            ? "Tugatish uchun bosing"
            : "Savol berish uchun mikrofonni bosing"}
        </div>
      </div>
    </div>
  );
}
