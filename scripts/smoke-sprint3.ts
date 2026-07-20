// Sprint 3 jonli smoke-test: Gemini API, kontekst qatlami va Google Calendar
// integratsiyasini haqiqiy kalitlar bilan tekshiradi (hech narsa saqlamaydi;
// kalendarda vaqtinchalik sinov eventi yaratib darhol o'chiradi).
// Ishga tushirish: npx tsx scripts/smoke-sprint3.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // 1) Gemini — oddiy strukturaviy chaqiruv
  const { generateJson } = await import("../src/lib/gemini");
  const ping = await generateJson<{ javob: string }>({
    prompt: "Salom! 'javob' maydonida bitta qisqa o'zbekcha gap qaytar.",
    schema: {
      type: "object",
      properties: { javob: { type: "string" } },
      required: ["javob"],
    },
  });
  console.log("[1] Gemini ulanishi OK:", ping.javob);

  // 2) Kontekst qatlami — DB'dagi haqiqiy foydalanuvchi bilan
  const { db } = await import("../src/db");
  const { users } = await import("../src/db/schema");
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    console.log("[2] DB'da foydalanuvchi yo'q — qolgan bosqichlar o'tkazib yuborildi");
    return;
  }
  const { buildAiContext, formatContextForPrompt } = await import(
    "../src/lib/ai-context"
  );
  const ctx = await buildAiContext(user.id);
  console.log(
    `[2] Kontekst OK: bugun ${ctx.todayTasks.length} ta vazifa, ` +
      `${ctx.activeGoals.length} ta faol maqsad; band vaqtlar: ` +
      (ctx.busyToday === null
        ? "Google ulanmagan"
        : `${ctx.busyToday.length} ta (bugun)`)
  );

  // 3) To'liq A–E tahlil (runManualAnalysis bilan bir xil prompt shakli;
  //    natija saqlanmaydi)
  const analysis = await generateJson<{
    xulosa: string;
    reja: { vaqt?: string; vazifa: string }[];
    ogohlantirishlar: string[];
    progress: { maqsad: string; foiz: number; baho: string }[];
    motivatsiya: string;
  }>({
    system:
      "Sen \"Maqsadlarim\" ilovasining shaxsiy AI yordamchisisan. Javoblaring faqat o'zbek tilida bo'lsin.",
    prompt: `Quyidagi kontekst asosida kunlik tahlil tayyorla (xulosa, ertangi reja, ogohlantirishlar, maqsadlar progressi, motivatsiya).\n\n=== KONTEKST ===\n${formatContextForPrompt(ctx)}`,
    schema: {
      type: "object",
      properties: {
        xulosa: { type: "string" },
        reja: {
          type: "array",
          items: {
            type: "object",
            properties: { vaqt: { type: "string" }, vazifa: { type: "string" } },
            required: ["vazifa"],
          },
        },
        ogohlantirishlar: { type: "array", items: { type: "string" } },
        progress: {
          type: "array",
          items: {
            type: "object",
            properties: {
              maqsad: { type: "string" },
              foiz: { type: "integer" },
              baho: { type: "string" },
            },
            required: ["maqsad", "foiz", "baho"],
          },
        },
        motivatsiya: { type: "string" },
      },
      required: ["xulosa", "reja", "ogohlantirishlar", "progress", "motivatsiya"],
    },
  });
  console.log(
    `[3] A–E tahlil OK: reja ${analysis.reja.length} band, ` +
      `ogohlantirish ${analysis.ogohlantirishlar.length} ta, ` +
      `progress ${analysis.progress.length} ta maqsad`
  );
  console.log("    Xulosa:", analysis.xulosa);
  console.log("    Motivatsiya:", analysis.motivatsiya);

  // 4) Google Calendar chiqish sinxroni — vaqtinchalik event yaratib o'chirish
  if (!user.googleRefreshToken) {
    console.log("[4] Google ulanmagan — kalendar yozish sinovi o'tkazib yuborildi");
    return;
  }
  const { createTaskEvent, deleteTaskEvent } = await import(
    "../src/lib/google-calendar"
  );
  const eventId = await createTaskEvent(user.id, {
    id: "smoke-test",
    title: "Sinov — Maqsadlarim (avtomatik o'chiriladi)",
    dueAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  if (eventId) {
    await deleteTaskEvent(user.id, eventId);
    console.log("[4] Kalendar yozish OK: sinov eventi yaratildi va o'chirildi");
  } else {
    console.log("[4] Kalendar yozish: token yaroqsiz — qayta ulash kerak");
  }
}

main()
  .then(() => {
    console.log("Smoke-test yakunlandi ✔");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Smoke-test xatosi:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
