import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL topilmadi (.env.local ni tekshiring)");
}
if (!process.env.ALLOWED_TELEGRAM_ID) {
  throw new Error("ALLOWED_TELEGRAM_ID topilmadi (.env.local ni tekshiring)");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

async function main() {
  const telegramId = BigInt(process.env.ALLOWED_TELEGRAM_ID!);

  let [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.telegramId, telegramId));

  if (!user) {
    [user] = await db
      .insert(schema.users)
      .values({ telegramId, name: "Test foydalanuvchi" })
      .returning();
    console.log("Foydalanuvchi yaratildi:", user.id);
  } else {
    console.log("Mavjud foydalanuvchi topildi:", user.id);
  }

  const userId = user.id;

  const now = new Date();
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  console.log("Eski test ma'lumotlari tozalanmoqda...");
  await db.delete(schema.expenses).where(eq(schema.expenses.userId, userId));
  await db.delete(schema.tasks).where(eq(schema.tasks.userId, userId));
  await db.delete(schema.goals).where(eq(schema.goals.userId, userId));
  await db.delete(schema.cards).where(eq(schema.cards.userId, userId));

  console.log("Maqsadlar qo'shilmoqda...");
  const insertedGoals = await db
    .insert(schema.goals)
    .values([
      {
        userId,
        title: "Kitob o'qish",
        description: "Har oy kamida 2 ta kitob o'qish",
        dueDate: daysFromNow(20),
        progress: 65,
        status: "active",
      },
      {
        userId,
        title: "Sport bilan shug'ullanish",
        description: "Haftasiga 4 marta mashq qilish",
        dueDate: daysFromNow(45),
        progress: 40,
        status: "active",
      },
      {
        userId,
        title: "Ingliz tili",
        description: "IELTS imtihoniga tayyorgarlik",
        dueDate: daysFromNow(90),
        progress: 85,
        status: "active",
      },
      {
        userId,
        title: "Uy yig'ishtirish",
        description: "Bahorgi umumiy tozalash",
        dueDate: daysFromNow(-3),
        progress: 100,
        status: "done",
      },
    ])
    .returning();

  const goalByTitle = Object.fromEntries(insertedGoals.map((g) => [g.title, g.id]));

  console.log("Vazifalar qo'shilmoqda...");
  await db.insert(schema.tasks).values([
    {
      userId,
      goalId: goalByTitle["Kitob o'qish"],
      title: "20 sahifa o'qish",
      dueAt: daysFromNow(0),
      priority: "mid",
      status: "pending",
    },
    {
      userId,
      goalId: goalByTitle["Sport bilan shug'ullanish"],
      title: "Ertalabki yugurish",
      dueAt: daysFromNow(0),
      priority: "high",
      status: "pending",
    },
    {
      userId,
      goalId: goalByTitle["Ingliz tili"],
      title: "50 ta so'z yodlash",
      dueAt: daysFromNow(1),
      priority: "mid",
      status: "pending",
    },
    {
      userId,
      goalId: null,
      title: "Kommunal to'lovlarni to'lash",
      dueAt: daysFromNow(2),
      priority: "high",
      status: "pending",
    },
    {
      userId,
      goalId: goalByTitle["Sport bilan shug'ullanish"],
      title: "Sport zaliga borish",
      dueAt: daysFromNow(-1),
      priority: "low",
      status: "pending",
    },
    {
      userId,
      goalId: goalByTitle["Uy yig'ishtirish"],
      title: "Kir yuvish",
      dueAt: daysFromNow(-2),
      priority: "low",
      status: "done",
    },
  ]);

  console.log("Kartalar qo'shilmoqda...");
  const insertedCards = await db
    .insert(schema.cards)
    .values([
      { userId, name: "Asosiy karta", numberMasked: "**** 4521", brand: "uzcard" },
      { userId, name: "Jamg'arma", numberMasked: "**** 7788", brand: "humo" },
    ])
    .returning();

  console.log("Xarajatlar qo'shilmoqda...");
  await db.insert(schema.expenses).values([
    {
      userId,
      cardId: insertedCards[0].id,
      title: "Supermarket",
      category: "Oziq-ovqat",
      amount: 145000,
      spentAt: daysFromNow(-1),
    },
    {
      userId,
      cardId: insertedCards[0].id,
      title: "Taksi",
      category: "Transport",
      amount: 32000,
      spentAt: daysFromNow(-2),
    },
    {
      userId,
      cardId: insertedCards[1].id,
      title: "Kafe",
      category: "Ovqatlanish",
      amount: 68000,
      spentAt: daysFromNow(-3),
    },
  ]);

  console.log("Seed muvaffaqiyatli yakunlandi.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
