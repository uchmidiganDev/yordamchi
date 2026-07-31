"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  setPhoneAiEnabled,
  setPhoneNumber,
  syncAgentAction,
  type PhoneCallView,
  type TelStatus,
} from "@/lib/actions/tel";
import { formatDateShortUz, formatTimeUz } from "@/lib/format-date";
import { PageHeader } from "../page-header";
import styles from "./tel.module.css";

function formatDuration(seconds: number | null) {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CallRow({ call }: { call: PhoneCallView }) {
  const [expanded, setExpanded] = useState(false);
  const d = call.startedAtISO ? new Date(call.startedAtISO) : null;
  const duration = formatDuration(call.durationSeconds);

  return (
    <Card padding="14px">
      <div className={styles.callHead}>
        <span className={styles.callFrom}>{call.callerNumber ?? "Noma'lum raqam"}</span>
        <span className={styles.callMeta}>
          {d ? `${formatDateShortUz(d)}, ${formatTimeUz(d)}` : call.status}
          {duration ? ` · ${duration}` : ""}
        </span>
      </div>

      {call.summary && <p className={styles.callSummary}>{call.summary}</p>}

      <div className={styles.callActions}>
        {call.transcript.length > 0 && (
          <button
            type="button"
            className={styles.transcriptToggle}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Suhbatni yashirish" : "Suhbat matnini ko'rish"}
          </button>
        )}
        {call.hasRecording && (
          <audio className={styles.audio} controls src={`/api/tel/recording/${call.id}`} />
        )}
      </div>

      {expanded && (
        <div className={styles.transcript}>
          {call.transcript.map((turn, i) => (
            <p key={i} className={styles.transcriptTurn}>
              <span
                className={`${styles.transcriptRole} ${turn.role === "agent" ? styles.agent : ""}`}
              >
                {turn.role === "agent" ? "AI:" : "Qo'ng'iroq qiluvchi:"}
              </span>
              {turn.message}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TelClient({
  initialStatus,
  initialCalls,
}: {
  initialStatus: TelStatus;
  initialCalls: PhoneCallView[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [phoneNumberIdInput, setPhoneNumberIdInput] = useState(status.phoneNumberId ?? "");
  const [phoneNumberE164Input, setPhoneNumberE164Input] = useState(status.phoneNumberE164 ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isSyncing, startSyncing] = useTransition();
  const [isToggling, startToggling] = useTransition();

  function handleSavePhoneNumber() {
    setSaveError(null);
    startSaving(async () => {
      const res = await setPhoneNumber(phoneNumberIdInput, phoneNumberE164Input);
      if (res.ok) {
        setStatus((s) => ({
          ...s,
          phoneNumberId: phoneNumberIdInput.trim(),
          phoneNumberE164: phoneNumberE164Input.trim() || null,
        }));
      } else {
        setSaveError(res.error);
      }
    });
  }

  function handleSync() {
    setSyncError(null);
    setSyncNotice(null);
    startSyncing(async () => {
      const res = await syncAgentAction();
      if (res.ok) {
        setSyncNotice("Agent bilim bazasi/system prompt bilan sinxronlandi.");
      } else {
        setSyncError(res.error);
      }
    });
  }

  function handleToggle() {
    const next = !status.enabled;
    setToggleError(null);
    startToggling(async () => {
      const res = await setPhoneAiEnabled(next);
      if (res.ok) {
        setStatus((s) => ({ ...s, enabled: next }));
      } else {
        setToggleError(res.error);
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Telefon"
        subtitle="Haqiqiy telefon qo'ng'iroqlariga AI (ElevenLabs Conversational AI) javob berishini shu yerdan boshqaring"
      />

      <div className={styles.wrap}>
        <Card padding="16px">
          <div className={styles.switchRow}>
            <div className={styles.rowBody}>
              <p className={styles.title}>AI qo&apos;ng&apos;iroqqa javob berish</p>
              <p className={styles.hint}>
                Yoqilganda, quyida kiritilgan ElevenLabs telefon raqamiga qo&apos;ng&apos;iroq
                kelsa AI (bilim bazangiz asosida) javob beradi. O&apos;chirilganda raqam
                agentdan ajratiladi.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={status.enabled}
              aria-label="AI qo'ng'iroqqa javob berish"
              className={`${styles.switch} ${status.enabled ? styles.switchOn : ""}`}
              onClick={handleToggle}
              disabled={isToggling || !status.phoneNumberId}
            >
              <span className={styles.switchThumb} />
            </button>
          </div>
          {toggleError && <p className={styles.error}>{toggleError}</p>}
        </Card>

        <Card padding="16px">
          <div className={styles.switchRow}>
            <div className={styles.rowBody}>
              <p className={styles.title}>AI agent</p>
              <p className={styles.hint}>
                Bilim bazangiz o&apos;zgarganda, o&apos;zgarishlarni telefon operatoriga
                yetkazish uchun sinxronlang.
              </p>
            </div>
            <span className={`${styles.statusBadge} ${status.agentId ? styles.statusOn : ""}`}>
              <span className={styles.statusDot} />
              {status.agentId ? "Yaratilgan" : "Hali yaratilmagan"}
            </span>
          </div>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? "Sinxronlanmoqda…" : "Sinxronlash"}
            </Button>
          </div>
          {syncNotice && <p className={styles.hint}>{syncNotice}</p>}
          {syncError && <p className={styles.error}>{syncError}</p>}
        </Card>

        <Card padding="16px">
          <p className={styles.title}>ElevenLabs telefon raqami</p>
          <p className={styles.hint}>
            Telnyx&apos;da (yoki boshqa SIP provayderda) olingan raqamni ElevenLabs
            paneli (Conversational AI → Phone Numbers) orqali SIP trunking bilan
            import qiling, so&apos;ng shu yerda uning ID sini kiriting.
          </p>
          <div className={styles.formRow}>
            <Input
              label="ElevenLabs phone_number ID *"
              placeholder="phnum_..."
              value={phoneNumberIdInput}
              onChange={(e) => setPhoneNumberIdInput(e.target.value)}
            />
            <Input
              label="Telefon raqami (ko'rsatuv uchun, ixtiyoriy)"
              placeholder="+998..."
              value={phoneNumberE164Input}
              onChange={(e) => setPhoneNumberE164Input(e.target.value)}
            />
          </div>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={handleSavePhoneNumber} disabled={isSaving}>
              {isSaving ? "Saqlanmoqda…" : "Saqlash"}
            </Button>
          </div>
          {saveError && <p className={styles.error}>{saveError}</p>}
        </Card>

        <Card padding="16px">
          <p className={styles.title}>Sozlash qadamlari (bir martalik)</p>
          <ol className={styles.steps}>
            <li>elevenlabs.io &gt; Conversational AI bo&apos;limida hisob oching.</li>
            <li>
              Telnyx (yoki boshqa SIP provayder)dan olingan raqamni Phone Numbers &gt;
              Import (SIP trunking) orqali ElevenLabs&apos;ga ulang.
            </li>
            <li>Yuqoridagi &quot;Sinxronlash&quot; tugmasi bilan AI agentni yarating.</li>
            <li>Import qilingan raqamning ID sini yuqoridagi formaga kiriting va saqlang.</li>
            <li>
              ElevenLabs&apos; da shu agent uchun post-call webhook manzili sifatida{" "}
              <code>/api/tel/webhook</code> ni qo&apos;shing va u yerdagi webhook
              maxfiy kalitini <code>ELEVENLABS_WEBHOOK_SECRET</code> muhit
              o&apos;zgaruvchisiga joylashtiring.
            </li>
            <li>&quot;AI qo&apos;ng&apos;iroqqa javob berish&quot; svitchini yoqing.</li>
          </ol>
        </Card>

        <h2 className={styles.sectionTitle}>So&apos;nggi qo&apos;ng&apos;iroqlar</h2>
        {initialCalls.length === 0 ? (
          <div className={styles.empty}>
            <h2>Hali qo&apos;ng&apos;iroq bo&apos;lmagan</h2>
            <p>AI orqali javob berilgan qo&apos;ng&apos;iroqlar shu yerda ko&apos;rinadi.</p>
          </div>
        ) : (
          <div className={styles.callList}>
            {initialCalls.map((call) => (
              <CallRow key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
