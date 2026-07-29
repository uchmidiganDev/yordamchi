"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import {
  setLinkAnalysisEnabled,
  setVideoDownloadEnabled,
  setVoiceReplyEnabled,
  type ShaxsiyAiSettings,
} from "@/lib/actions/shaxsiy-ai";
import { PageHeader } from "../page-header";
import styles from "./shaxsiy-ai.module.css";

function ToggleCard({
  title,
  hint,
  initialEnabled,
  onToggle,
}: {
  title: string;
  hint: string;
  initialEnabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await onToggle(next);
    });
  }

  return (
    <Card padding="16px">
      <div className={styles.switchRow}>
        <div className={styles.rowBody}>
          <p className={styles.title}>{title}</p>
          <p className={styles.hint}>{hint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          className={`${styles.switch} ${enabled ? styles.switchOn : ""}`}
          onClick={toggle}
          disabled={isPending}
        >
          <span className={styles.switchThumb} />
        </button>
      </div>
    </Card>
  );
}

export function ShaxsiyAiClient({ initialSettings }: { initialSettings: ShaxsiyAiSettings }) {
  return (
    <div>
      <PageHeader
        title="Shaxsiy AI"
        subtitle="Telegram Business orqali shaxsiy akkauntingizga yozgan odamlarga AI qanday javob berishini shu yerdan boshqaring"
      />

      <div className={styles.wrap}>
        <Card padding="16px">
          <div className={styles.switchRow}>
            <div className={styles.rowBody}>
              <p className={styles.title}>Telegram Business ulanishi</p>
              <p className={styles.hint}>
                Ulanish Telegram&apos;ning o&apos;zida (Sozlamalar → Telegram Business →
                Chatbots) amalga oshiriladi. Holatni{" "}
                <a href="/telegram">Telegram sahifasida</a> ko&apos;rishingiz mumkin.
              </p>
            </div>
            <span
              className={`${styles.statusBadge} ${initialSettings.businessConnected ? styles.statusOn : ""}`}
            >
              <span className={styles.statusDot} />
              {initialSettings.businessConnected ? "Ulangan" : "Ulanmagan"}
            </span>
          </div>
        </Card>

        <ToggleCard
          title="Ovozli xabarga ovozli javob"
          hint="Kimdir sizga ovozli xabar yuborsa, AI uni matnga aylantirib javob beradi va javobning ovozli versiyasini ham yuboradi."
          initialEnabled={initialSettings.voiceReplyEnabled}
          onToggle={setVoiceReplyEnabled}
        />

        <ToggleCard
          title="Havola (link) tahlili"
          hint="Kimdir sizga faqat bitta havola yuborsa (masalan https://example.com), AI saytni tahlil qilib hisobot beradi."
          initialEnabled={initialSettings.linkAnalysisEnabled}
          onToggle={setLinkAnalysisEnabled}
        />

        <ToggleCard
          title="YouTube/Instagram videosini yuklab berish"
          hint="Kimdir YouTube yoki Instagram havolasini yuborsa, AI videoni yuklab, faylni to'g'ridan-to'g'ri yuboradi. DIQQAT: bu rasmiy xizmat emas — ba'zan (video juda katta bo'lsa yoki platforma tuzilmasi o'zgarsa) ishlamasligi mumkin."
          initialEnabled={initialSettings.videoDownloadEnabled}
          onToggle={setVideoDownloadEnabled}
        />
      </div>
    </div>
  );
}
