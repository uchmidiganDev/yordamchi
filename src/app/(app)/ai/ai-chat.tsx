"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { askAssistant } from "@/lib/actions/assistant";
import styles from "./ai-chat.module.css";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
};

export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function send() {
    const question = input.trim();
    if (!question || isPending) return;

    setMessages((ms) => [...ms, { id: `u-${Date.now()}`, role: "user", text: question }]);
    setInput("");

    startTransition(async () => {
      const res = await askAssistant(question);
      setMessages((ms) => [
        ...ms,
        res.ok
          ? { id: `a-${Date.now()}`, role: "assistant", text: res.answer }
          : { id: `e-${Date.now()}`, role: "error", text: res.error },
      ]);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <Card padding="16px" className={styles.chatCard}>
      <h2 className={styles.chatTitle}>AI bilan suhbat</h2>
      <p className={styles.chatHint}>
        Savolingizga avval Bilim bazasi va System Prompt asosida javob beriladi.
      </p>

      {messages.length > 0 && (
        <div className={styles.messages}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.bubbleRow} ${m.role === "user" ? styles.bubbleRowUser : ""}`}
            >
              <div
                className={`${styles.bubble} ${
                  m.role === "user"
                    ? styles.bubbleUser
                    : m.role === "error"
                      ? styles.bubbleError
                      : styles.bubbleAssistant
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {isPending && (
            <div className={styles.bubbleRow}>
              <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>Yozmoqda…</div>
            </div>
          )}
        </div>
      )}

      <div className={styles.inputRow}>
        <input
          className={styles.chatInput}
          placeholder="Savolingizni yozing..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button variant="primary" onClick={send} disabled={isPending || !input.trim()}>
          Yubor
        </Button>
      </div>
    </Card>
  );
}
