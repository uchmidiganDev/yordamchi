import { Card } from "@/components/ui/Card";
import { StatusTag } from "@/components/ui/StatusTag";
import { PageHeader } from "../page-header";
import styles from "./ai.module.css";

const SUGGESTIONS = [
  "Bu hafta 'Kitob o'qish' maqsadi bo'yicha kamida 3 marta o'qishni rejalashtiring.",
  "'Sport bilan shug'ullanish' maqsadingiz uchun ertalabki vaqt band emas — soat 7:00 ga vazifa qo'shishni tavsiya qilamiz.",
  "Oxirgi 7 kunda 2 ta vazifa muddati o'tkazib yuborilgan. Muddatlarni qayta rejalashtirishni xohlaysizmi?",
];

const CHAT = [
  { from: "user" as const, text: "Bu oy uchun maqsadlarimni tahlil qilib ber." },
  {
    from: "ai" as const,
    text:
      "Bu funksiya hali ishlab chiqilmoqda. Keyingi sprintda AI yordamchi haqiqiy tavsiyalar va tahlillar bera boshlaydi.",
  },
];

export default function AiPage() {
  return (
    <div>
      <PageHeader title="AI yordamchi" subtitle="Maqsad va vazifalaringiz bo'yicha tavsiyalar" />

      <div className={styles.wrap}>
        <Card padding="16px" className={styles.noticeCard}>
          <StatusTag status="pending">Tez orada</StatusTag>
          <p className={styles.noticeText}>
            Bu sahifa hozircha namuna (statik) ma&apos;lumotlar bilan ko&apos;rsatilmoqda. Haqiqiy
            AI tahlil va tavsiya mantig&apos;i keyingi sprintda qo&apos;shiladi.
          </p>
        </Card>

        <h2 className={styles.sectionTitle}>Tavsiyalar</h2>
        <div className={styles.list}>
          {SUGGESTIONS.map((s, i) => (
            <Card key={i} padding="14px">
              <p className={styles.suggestion}>{s}</p>
            </Card>
          ))}
        </div>

        <h2 className={styles.sectionTitle}>Suhbat namunasi</h2>
        <Card padding="16px">
          <div className={styles.chat}>
            {CHAT.map((m, i) => (
              <div key={i} className={`${styles.bubble} ${m.from === "user" ? styles.bubbleUser : styles.bubbleAi}`}>
                {m.text}
              </div>
            ))}
          </div>
          <div className={styles.chatInputRow}>
            <input
              className={styles.chatInput}
              placeholder="Xabar yozing…"
              disabled
            />
            <button className={styles.chatSend} disabled aria-label="Yuborish">
              →
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
