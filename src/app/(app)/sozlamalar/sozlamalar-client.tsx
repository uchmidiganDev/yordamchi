"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusTag } from "@/components/ui/StatusTag";
import { updateSettings, disconnectGoogle } from "@/lib/actions/settings";
import { PageHeader } from "../page-header";
import styles from "./sozlamalar.module.css";

const TIMEZONES = [
  { value: "Asia/Tashkent", label: "Toshkent (UTC+5)" },
  { value: "Asia/Almaty", label: "Almati (UTC+6)" },
  { value: "Europe/Moscow", label: "Moskva (UTC+3)" },
  { value: "UTC", label: "UTC" },
];

type Initial = {
  name: string;
  telegramUsername: string | null;
  telegramId: string;
  timezone: string;
  morningTime: string;
  eveningTime: string;
  googleConnected: boolean;
};

export function SozlamalarClient({
  initial,
  googleStatus,
}: {
  initial: Initial;
  googleStatus: "connected" | "error" | null;
}) {
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [morningTime, setMorningTime] = useState(initial.morningTime);
  const [eveningTime, setEveningTime] = useState(initial.eveningTime);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      await updateSettings({ name, timezone, morningTime, eveningTime });
      setSaved(true);
    });
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function handleConnectGoogle() {
    window.location.href = "/api/auth/google/start";
  }

  function handleDisconnectGoogle() {
    startGoogleTransition(async () => {
      await disconnectGoogle();
    });
  }

  return (
    <div>
      <PageHeader title="Sozlamalar" subtitle="Hisobingiz va bildirishnoma sozlamalari" />

      <div className={styles.wrap}>
        <Card padding="16px">
          <h2 className={styles.sectionTitle}>Profil</h2>
          <Input label="Ism" value={name} onChange={(e) => setName(e.target.value)} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Telegram</span>
            <div className={styles.rowValue}>
              <StatusTag status="done">Ulangan</StatusTag>
              <span className={styles.muted}>
                {initial.telegramUsername ? `@${initial.telegramUsername}` : `ID: ${initial.telegramId}`}
              </span>
            </div>
          </div>
        </Card>

        <Card padding="16px">
          <h2 className={styles.sectionTitle}>Tahlil vaqtlari</h2>
          <div className={styles.grid2}>
            <Input
              label="Ertalabki vaqt"
              type="time"
              value={morningTime}
              onChange={(e) => setMorningTime(e.target.value)}
            />
            <Input
              label="Kechqurungi vaqt"
              type="time"
              value={eveningTime}
              onChange={(e) => setEveningTime(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Vaqt mintaqasi</label>
            <select
              className={styles.select}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card padding="16px">
          <h2 className={styles.sectionTitle}>Google kalendar</h2>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Ulanish holati</span>
            <div className={styles.rowValue}>
              <StatusTag status={initial.googleConnected ? "done" : "pending"}>
                {initial.googleConnected ? "Ulangan" : "Ulanmagan"}
              </StatusTag>
            </div>
          </div>
          {googleStatus === "connected" && (
            <p className={styles.savedHint}>Google kalendar muvaffaqiyatli ulandi</p>
          )}
          {googleStatus === "error" && (
            <p className={styles.hint}>Google kalendarni ulashda xatolik yuz berdi. Qaytadan urinib ko&apos;ring.</p>
          )}
          <p className={styles.hint}>
            Vazifa va maqsad muddatlarini Google kalendar bilan sinxronlash keyingi sprintda qo&apos;shiladi.
            Hozircha faqat hisobingizni ulash mumkin.
          </p>
          {initial.googleConnected ? (
            <Button variant="secondary" onClick={handleDisconnectGoogle} disabled={isGooglePending}>
              {isGooglePending ? "Uzilmoqda…" : "Google kalendarni uzish"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleConnectGoogle}>
              Google bilan ulash
            </Button>
          )}
        </Card>

        <div className={styles.saveRow}>
          {saved && <span className={styles.savedHint}>Saqlandi</span>}
          <Button variant="primary" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
        </div>

        <button className={styles.logoutBtn} onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? "Chiqilmoqda…" : "Hisobdan chiqish"}
        </button>
      </div>
    </div>
  );
}
