// AI'ga yuboriladigan kontekstni yig'uvchi qatlam. Gemini prompt'iga
// beriladigan ma'lumot: bugungi/kechagi vazifalar va holati, faol maqsadlar
// progressi, Google Calendar band vaqtlari va oxirgi tahlillar.

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { analyses, goals, taskOccurrences, tasks, users } from "@/db/schema";
import { listBusyEvents, type BusyEvent } from "./google-calendar";
import {
  addDaysToDateStr,
  dateStrInTz,
  dayRangeInTz,
  timeStrInTz,
} from "./tz";

type TaskLine = {
  title: string;
  priority: string;
  done: boolean;
  time: string | null; // HH:MM (foydalanuvchi mintaqasida)
  goalTitle: string | null;
  recurring: boolean;
};

export type AiContext = {
  userName: string;
  timezone: string;
  todayStr: string;
  todayTasks: TaskLine[];
  yesterdayTasks: TaskLine[];
  overdueTasks: { title: string; dueStr: string; goalTitle: string | null }[];
  tomorrowTasks: TaskLine[];
  undatedTasks: { title: string; priority: string; goalTitle: string | null }[];
  activeGoals: {
    title: string;
    progress: number;
    dueStr: string | null;
    tasksTotal: number;
    tasksDone: number;
  }[];
  busyToday: BusyEvent[] | null; // null — Google ulanmagan
  busyTomorrow: BusyEvent[] | null;
  recentAnalyses: { dateStr: string; excerpt: string }[];
};

const timeInTz = timeStrInTz;

export async function buildAiContext(userId: string): Promise<AiContext> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new Error("Foydalanuvchi topilmadi");

  const tz = user.timezone;
  const now = new Date();
  const todayStr = dateStrInTz(now, tz);
  const yesterdayStr = addDaysToDateStr(todayStr, -1);
  const tomorrowStr = addDaysToDateStr(todayStr, 1);
  const today = dayRangeInTz(todayStr, tz);
  const yesterday = dayRangeInTz(yesterdayStr, tz);
  const tomorrow = dayRangeInTz(tomorrowStr, tz);

  const [allTasks, allGoals, occRows, recentRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueAt: tasks.dueAt,
        priority: tasks.priority,
        status: tasks.status,
        recurrence: tasks.recurrence,
        goalId: tasks.goalId,
      })
      .from(tasks)
      .where(eq(tasks.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db
      .select({
        taskId: taskOccurrences.taskId,
        date: taskOccurrences.date,
        status: taskOccurrences.status,
      })
      .from(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.userId, userId),
          inArray(taskOccurrences.date, [todayStr, yesterdayStr])
        )
      ),
    db
      .select({ content: analyses.content, createdAt: analyses.createdAt })
      .from(analyses)
      .where(eq(analyses.userId, userId))
      .orderBy(desc(analyses.createdAt))
      .limit(3),
  ]);

  const goalTitle = (goalId: string | null) =>
    allGoals.find((g) => g.id === goalId)?.title ?? null;

  const occDone = (taskId: string, dateStr: string) =>
    occRows.some(
      (o) => o.taskId === taskId && o.date === dateStr && o.status === "done"
    );

  const inRange = (d: Date | null, r: { start: Date; end: Date }) =>
    d !== null && d >= r.start && d < r.end;

  // Takrorlanuvchi vazifalar har kuni "kun ro'yxatida" hisoblanadi.
  const recurring = allTasks.filter((t) => t.recurrence !== "none");
  const oneOff = allTasks.filter((t) => t.recurrence === "none");

  const dayTasks = (
    range: { start: Date; end: Date },
    dateStr: string
  ): TaskLine[] => [
    ...recurring.map((t) => ({
      title: t.title,
      priority: t.priority,
      done: occDone(t.id, dateStr),
      time: t.dueAt ? timeInTz(t.dueAt, tz) : null,
      goalTitle: goalTitle(t.goalId),
      recurring: true,
    })),
    ...oneOff
      .filter((t) => inRange(t.dueAt, range))
      .map((t) => ({
        title: t.title,
        priority: t.priority,
        done: t.status === "done",
        time: t.dueAt ? timeInTz(t.dueAt, tz) : null,
        goalTitle: goalTitle(t.goalId),
        recurring: false,
      })),
  ];

  const overdueTasks = oneOff
    .filter((t) => t.status === "pending" && t.dueAt && t.dueAt < today.start)
    .map((t) => ({
      title: t.title,
      dueStr: dateStrInTz(t.dueAt!, tz),
      goalTitle: goalTitle(t.goalId),
    }));

  const undatedTasks = oneOff
    .filter((t) => t.status === "pending" && !t.dueAt)
    .map((t) => ({
      title: t.title,
      priority: t.priority,
      goalTitle: goalTitle(t.goalId),
    }));

  const activeGoals = allGoals
    .filter((g) => g.status === "active")
    .map((g) => {
      const goalTasks = allTasks.filter((t) => t.goalId === g.id);
      return {
        title: g.title,
        progress: g.progress,
        dueStr: g.dueDate ? dateStrInTz(g.dueDate, tz) : null,
        tasksTotal: goalTasks.length,
        tasksDone: goalTasks.filter(
          (t) => t.recurrence === "none" && t.status === "done"
        ).length,
      };
    });

  // Band vaqtlar: bugun boshidan ertaga oxirigacha bitta so'rov.
  let busyToday: BusyEvent[] | null = null;
  let busyTomorrow: BusyEvent[] | null = null;
  try {
    const busy = await listBusyEvents(userId, today.start, tomorrow.end);
    if (busy) {
      busyToday = busy.filter((b) => new Date(b.start) < today.end);
      busyTomorrow = busy.filter((b) => new Date(b.end) > tomorrow.start);
    }
  } catch {
    // Kalendar o'qib bo'lmasa AI kontekstsiz davom etadi.
  }

  const recentAnalyses = recentRows.map((r) => {
    let excerpt = r.content;
    try {
      const parsed = JSON.parse(r.content) as { xulosa?: string };
      if (parsed.xulosa) excerpt = parsed.xulosa;
    } catch {
      // eski/oddiy matn bo'lsa o'zi qoladi
    }
    return {
      dateStr: dateStrInTz(r.createdAt, tz),
      excerpt: excerpt.slice(0, 300),
    };
  });

  return {
    userName: user.name?.trim() || "Foydalanuvchi",
    timezone: tz,
    todayStr,
    todayTasks: dayTasks(today, todayStr),
    yesterdayTasks: dayTasks(yesterday, yesterdayStr),
    overdueTasks,
    tomorrowTasks: dayTasks(tomorrow, tomorrowStr).filter((t) => !t.recurring),
    undatedTasks,
    activeGoals,
    busyToday,
    busyTomorrow,
    recentAnalyses,
  };
}

const PRIORITY_UZ: Record<string, string> = {
  high: "yuqori",
  mid: "o'rta",
  low: "past",
};

function taskLinesText(items: TaskLine[]): string {
  if (items.length === 0) return "  (yo'q)";
  return items
    .map((t) => {
      const bits = [
        t.done ? "[bajarilgan]" : "[bajarilmagan]",
        t.title,
        `(muhimlik: ${PRIORITY_UZ[t.priority] ?? t.priority}${t.recurring ? ", takrorlanuvchi" : ""}${t.time ? `, vaqti: ${t.time}` : ""}${t.goalTitle ? `, maqsad: ${t.goalTitle}` : ""})`,
      ];
      return `  - ${bits.join(" ")}`;
    })
    .join("\n");
}

function busyText(items: BusyEvent[] | null, tz: string): string {
  if (items === null) return "  (Google Calendar ulanmagan — band vaqtlar noma'lum)";
  if (items.length === 0) return "  (band vaqt yo'q)";
  return items
    .map((b) =>
      b.allDay
        ? `  - Kun bo'yi: ${b.title}`
        : `  - ${timeInTz(new Date(b.start), tz)}–${timeInTz(new Date(b.end), tz)}: ${b.title}`
    )
    .join("\n");
}

// Kontekstni Gemini prompt'i uchun o'qiladigan matnga aylantiradi.
export function formatContextForPrompt(ctx: AiContext): string {
  const goalsText =
    ctx.activeGoals.length === 0
      ? "  (faol maqsad yo'q)"
      : ctx.activeGoals
          .map(
            (g) =>
              `  - ${g.title}: progress ${g.progress}%${g.dueStr ? `, muddat: ${g.dueStr}` : ""}, bog'liq vazifalar: ${g.tasksDone}/${g.tasksTotal} bajarilgan`
          )
          .join("\n");

  const overdueText =
    ctx.overdueTasks.length === 0
      ? "  (yo'q)"
      : ctx.overdueTasks
          .map(
            (t) =>
              `  - ${t.title} (muddati: ${t.dueStr}${t.goalTitle ? `, maqsad: ${t.goalTitle}` : ""})`
          )
          .join("\n");

  const undatedText =
    ctx.undatedTasks.length === 0
      ? "  (yo'q)"
      : ctx.undatedTasks
          .map(
            (t) =>
              `  - ${t.title} (muhimlik: ${PRIORITY_UZ[t.priority] ?? t.priority}${t.goalTitle ? `, maqsad: ${t.goalTitle}` : ""})`
          )
          .join("\n");

  const historyText =
    ctx.recentAnalyses.length === 0
      ? "  (oldingi tahlil yo'q)"
      : ctx.recentAnalyses
          .map((a) => `  - ${a.dateStr}: ${a.excerpt}`)
          .join("\n");

  return [
    `Foydalanuvchi: ${ctx.userName}. Bugungi sana: ${ctx.todayStr} (${ctx.timezone}).`,
    "",
    "BUGUNGI VAZIFALAR:",
    taskLinesText(ctx.todayTasks),
    "",
    "KECHAGI VAZIFALAR:",
    taskLinesText(ctx.yesterdayTasks),
    "",
    "MUDDATI O'TIB KETGAN VAZIFALAR:",
    overdueText,
    "",
    "ERTAGA REJALASHTIRILGAN VAZIFALAR:",
    taskLinesText(ctx.tomorrowTasks),
    "",
    "MUDDATSIZ (rejalashtirilmagan) VAZIFALAR:",
    undatedText,
    "",
    "FAOL MAQSADLAR:",
    goalsText,
    "",
    "BUGUNGI BAND VAQTLAR (Google Calendar):",
    busyText(ctx.busyToday, ctx.timezone),
    "",
    "ERTANGI BAND VAQTLAR (Google Calendar):",
    busyText(ctx.busyTomorrow, ctx.timezone),
    "",
    "OXIRGI TAHLILLAR (xulosalar):",
    historyText,
  ].join("\n");
}
