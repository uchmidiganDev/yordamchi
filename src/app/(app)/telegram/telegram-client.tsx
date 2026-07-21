"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { TrashIcon } from "@/components/ui/icons";
import {
  addTelegramBot,
  removeTelegramBot,
  setTelegramBotEnabled,
} from "@/lib/actions/telegram-bots";
import { formatDateShortUz, formatTimeUz } from "@/lib/format-date";
import { PageHeader } from "../page-header";
import listStyles from "../list.module.css";
import styles from "./telegram.module.css";

type BotView = {
  id: string;
  username: string;
  enabled: boolean;
  createdAtISO: string;
};

type MessageView = {
  id: string;
  botUsername: string;
  fromName: string | null;
  fromUsername: string | null;
  text: string;
  answer: string | null;
  createdAtISO: string;
};

function BotRow({
  bot,
  onToggle,
  onDelete,
}: {
  bot: BotView;
  onToggle: (bot: BotView) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card padding="14px">
      <div className={styles.switchRow}>
        <div className={styles.rowBody}>
          <p className={styles.title}>@{bot.username}</p>
          <p className={styles.hint}>{bot.enabled ? "Ishlamoqda" : "To'xtatilgan"}</p>
        </div>
        <div className={styles.botActions}>
          <button
            type="button"
            role="switch"
            aria-checked={bot.enabled}
            aria-label={bot.enabled ? "Botni to'xtatish" : "Botni ishga tushirish"}
            className={`${styles.switch} ${bot.enabled ? styles.switchOn : ""}`}
            onClick={() => onToggle(bot)}
          >
            <span className={styles.switchThumb} />
          </button>
          <button
            className={`${listStyles.iconBtn} danger`}
            onClick={() => onDelete(bot.id)}
            aria-label="Botni o'chirish"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </Card>
  );
}

function AddBotSheet({ onCancel, onAdded }: { onCancel: () => void; onAdded: (username: string) => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!token.trim()) {
      setError("Token kiritilishi shart");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addTelegramBot(token);
      if (res.ok) {
        onAdded(res.data.username);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Sheet title="Yangi bot qo'shish" onClose={onCancel}>
      <p className={styles.hint}>
        BotFather&apos;dan olgan tokenni joylashtiring. Tekshirilgach webhook
        avtomatik sozlanadi.
      </p>
      <Input
        label="Bot tokeni *"
        placeholder="123456789:AA..."
        value={token}
        onChange={(e) => setToken(e.target.value)}
        error={error ?? undefined}
        autoFocus
      />
      <div className={styles.sheetFoot}>
        <Button variant="secondary" onClick={onCancel}>
          Bekor qilish
        </Button>
        <Button variant="primary" onClick={submit} disabled={isPending}>
          {isPending ? "Tekshirilmoqda…" : "Qo'shish"}
        </Button>
      </div>
    </Sheet>
  );
}

function MessageRow({ message }: { message: MessageView }) {
  const d = new Date(message.createdAtISO);
  const from = message.fromUsername
    ? `@${message.fromUsername}`
    : message.fromName ?? "Noma'lum";

  return (
    <Card padding="14px">
      <div className={styles.msgHead}>
        <span className={styles.msgFrom}>{from}</span>
        <span className={styles.msgMeta}>
          @{message.botUsername} · {formatDateShortUz(d)}, {formatTimeUz(d)}
        </span>
      </div>
      <p className={styles.msgText}>{message.text}</p>
      {message.answer && <p className={styles.msgAnswer}>{message.answer}</p>}
    </Card>
  );
}

export function TelegramClient({
  initialBots,
  initialMessages,
}: {
  initialBots: BotView[];
  initialMessages: MessageView[];
}) {
  const [bots, setBots] = useState(initialBots);
  const [messages] = useState(initialMessages);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleToggle(bot: BotView) {
    const next = !bot.enabled;
    setBots((bs) => bs.map((b) => (b.id === bot.id ? { ...b, enabled: next } : b)));
    startTransition(async () => {
      await setTelegramBotEnabled(bot.id, next);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Bu botni o'chirishga ishonchingiz komilmi?")) return;
    setBots((bs) => bs.filter((b) => b.id !== id));
    startTransition(async () => {
      await removeTelegramBot(id);
    });
  }

  function handleAdded() {
    setSheetOpen(false);
    window.location.reload();
  }

  return (
    <div>
      <PageHeader
        title="Telegram"
        subtitle="Bilim bazangiz asosida javob beruvchi botlaringiz"
      />

      <div className={styles.wrap}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Botlar</h2>
          <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
            + Bot qo&apos;shish
          </Button>
        </div>

        {bots.length === 0 ? (
          <div className={listStyles.empty}>
            <h2>Hali bot yo&apos;q</h2>
            <p>BotFather&apos;dan olgan tokenni qo&apos;shib, birinchi botingizni ulang.</p>
          </div>
        ) : (
          <div className={styles.botList}>
            {bots.map((bot) => (
              <BotRow key={bot.id} bot={bot} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        )}

        <h2 className={styles.sectionTitle}>Xabarlar</h2>
        {messages.length === 0 ? (
          <p className={styles.hint}>Hali xabar kelmagan.</p>
        ) : (
          <div className={styles.msgList}>
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {sheetOpen && <AddBotSheet onCancel={() => setSheetOpen(false)} onAdded={handleAdded} />}
    </div>
  );
}
