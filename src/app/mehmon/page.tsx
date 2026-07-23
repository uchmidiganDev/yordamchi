"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./mehmon.module.css";
import { VoiceModal } from "./voice-modal";

type ChatMessage = { role: "user" | "assistant"; text: string };

const HISTORY_LIMIT = 6;

const GREETING: ChatMessage = {
  role: "assistant",
  text: "Salom! Men AI yordamchiman. Savolingizni yozing.",
};

export default function MehmonPage() {
  const [hasTelegram, setHasTelegram] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `window.Telegram` faqat clientda mavjud — hydration mos kelishi uchun
    // bu qiymat mount'dan keyin (effektda) o'rnatiladi, render vaqtida emas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasTelegram(Boolean(window.Telegram?.WebApp?.initData));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  async function handleSend() {
    const question = input.trim();
    const initData = window.Telegram?.WebApp?.initData;
    if (!question || sending || !initData) return;

    const history = messages
      .filter((m) => m !== GREETING)
      .reduce<{ question: string; answer: string }[]>((turns, m, i, arr) => {
        if (m.role === "user" && arr[i + 1]?.role === "assistant") {
          turns.push({ question: m.text, answer: arr[i + 1].text });
        }
        return turns;
      }, [])
      .slice(-HISTORY_LIMIT);

    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/assistant/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, question, history }),
      });
      const data = await res.json().catch(() => null);
      const answer =
        res.ok && data?.ok
          ? (data.answer as string)
          : "Kechirasiz, javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.";
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Kechirasiz, javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (hasTelegram === false) {
    return (
      <main className={styles.page}>
        <div className={styles.notice}>
          Bu sahifa faqat Telegram ilovasi ichida (Mini App sifatida) ishlaydi.
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>AI Yordamchi</div>
        <div className={styles.headerSubtitle}>Savolingizni yozing, javob beraman</div>
      </div>

      <div className={styles.messages} ref={listRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.bubble} ${
              m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
            }`}
          >
            {m.text}
          </div>
        ))}
        {sending && (
          <div className={styles.typing}>
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </div>
        )}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.textarea}
          rows={1}
          placeholder="Savolingizni yozing…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          type="button"
          className={styles.micIconBtn}
          onClick={() => setVoiceOpen(true)}
          aria-label="Ovozli suhbat"
        >
          🎤
        </button>
        <button
          type="button"
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-label="Yuborish"
        >
          ➤
        </button>
      </div>

      {voiceOpen && <VoiceModal onClose={() => setVoiceOpen(false)} />}
    </main>
  );
}
