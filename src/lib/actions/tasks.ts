"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { goals, tasks, taskOccurrences } from "@/db/schema";
import {
  createTaskEvent,
  deleteTaskEvent,
  updateTaskEvent,
} from "@/lib/google-calendar";
import { requireUserId } from "./require-user";

export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export type TaskInput = {
  title: string;
  goalId?: string | null;
  dueAt?: string; // ISO datetime-local qiymati, bo'sh bo'lishi mumkin
  priority: "high" | "mid" | "low";
  recurrence?: Recurrence;
};

const PRIORITIES = new Set(["high", "mid", "low"]);
const RECURRENCES = new Set(["none", "daily", "weekly", "monthly"]);

// datetime-local qiymatini tekshiradi va Date qaytaradi. Noto'g'ri formatda
// bo'lsa xatolik chiqaradi (server tomon validatsiya).
function parseDueAt(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Sana/vaqt formati noto'g'ri");
  }
  return d;
}

// Mahalliy sanani YYYY-MM-DD ko'rinishida beradi (occurrence kaliti uchun).
function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Google Calendar chiqish sinxroni (vazifa → event). Faqat vaqti belgilangan
// bir martalik vazifalar sinxronlanadi. Best-effort: kalendar xatosi CRUD
// amalini to'xtatmasligi kerak.
async function syncTaskToCalendar(
  userId: string,
  row: {
    id: string;
    title: string;
    dueAt: Date | null;
    recurrence: string;
    googleEventId: string | null;
  }
) {
  try {
    const syncable = row.dueAt !== null && row.recurrence === "none";

    if (!syncable) {
      if (row.googleEventId) {
        await deleteTaskEvent(userId, row.googleEventId);
        await db
          .update(tasks)
          .set({ googleEventId: null })
          .where(eq(tasks.id, row.id));
      }
      return;
    }

    const payload = { id: row.id, title: row.title, dueAt: row.dueAt! };
    const eventId = row.googleEventId
      ? await updateTaskEvent(userId, row.googleEventId, payload)
      : await createTaskEvent(userId, payload);

    if (eventId !== row.googleEventId) {
      await db
        .update(tasks)
        .set({ googleEventId: eventId })
        .where(eq(tasks.id, row.id));
    }
  } catch (e) {
    console.error("Google Calendar sinxron xatosi:", e);
  }
}

export async function listTasksWithGoal() {
  const userId = await requireUserId();
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      priority: tasks.priority,
      status: tasks.status,
      recurrence: tasks.recurrence,
      goalId: tasks.goalId,
      goalTitle: goals.title,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(goals, eq(tasks.goalId, goals.id))
    .where(eq(tasks.userId, userId))
    .orderBy(asc(tasks.dueAt));

  // Takrorlanuvchi vazifalar uchun bugungi occurrence holatini olamiz.
  const todayStr = localDateStr(new Date());
  const todaysOccurrences = await db
    .select({ taskId: taskOccurrences.taskId, status: taskOccurrences.status })
    .from(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        eq(taskOccurrences.date, todayStr)
      )
    );
  const doneToday = new Set(
    todaysOccurrences.filter((o) => o.status === "done").map((o) => o.taskId)
  );

  return rows.map((r) => ({
    ...r,
    todayDone: r.recurrence !== "none" ? doneToday.has(r.id) : false,
  }));
}

export async function createTask(input: TaskInput) {
  const userId = await requireUserId();
  const title = input.title.trim();
  if (!title) throw new Error("Sarlavha kiritilishi shart");
  if (!PRIORITIES.has(input.priority)) {
    throw new Error("Muhimlik qiymati noto'g'ri");
  }
  const recurrence = input.recurrence ?? "none";
  if (!RECURRENCES.has(recurrence)) {
    throw new Error("Takrorlanish qiymati noto'g'ri");
  }
  const dueAt = parseDueAt(input.dueAt);

  const [row] = await db
    .insert(tasks)
    .values({
      userId,
      title,
      goalId: input.goalId || null,
      dueAt,
      priority: input.priority,
      recurrence,
    })
    .returning({ id: tasks.id });

  await syncTaskToCalendar(userId, {
    id: row.id,
    title,
    dueAt,
    recurrence,
    googleEventId: null,
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  const userId = await requireUserId();

  if (input.priority !== undefined && !PRIORITIES.has(input.priority)) {
    throw new Error("Muhimlik qiymati noto'g'ri");
  }
  if (input.recurrence !== undefined && !RECURRENCES.has(input.recurrence)) {
    throw new Error("Takrorlanish qiymati noto'g'ri");
  }

  const [row] = await db
    .update(tasks)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.goalId !== undefined ? { goalId: input.goalId || null } : {}),
      ...(input.dueAt !== undefined ? { dueAt: parseDueAt(input.dueAt) } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.recurrence !== undefined
        ? { recurrence: input.recurrence }
        : {}),
    })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      recurrence: tasks.recurrence,
      googleEventId: tasks.googleEventId,
    });

  if (row) {
    await syncTaskToCalendar(userId, row);
  }

  revalidatePath("/tasks");
}

export async function toggleTaskStatus(id: string, done: boolean) {
  const userId = await requireUserId();
  await db
    .update(tasks)
    .set({ status: done ? "done" : "pending" })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
}

// Takrorlanuvchi vazifaning ma'lum bir kundagi holatini belgilaydi. `done`
// bo'lsa occurrence yoziladi/yangilanadi, aks holda o'chiriladi (kun qayta
// "bajarilmagan" holatiga qaytadi). Sana berilmasa bugungi kun olinadi.
export async function toggleOccurrence(
  taskId: string,
  done: boolean,
  dateStr?: string
) {
  const userId = await requireUserId();

  // Vazifa haqiqatan shu foydalanuvchiniki ekanini tekshiramiz.
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) throw new Error("Vazifa topilmadi");

  const date = dateStr ?? localDateStr(new Date());

  if (done) {
    await db
      .insert(taskOccurrences)
      .values({ taskId, userId, date, status: "done" })
      .onConflictDoUpdate({
        target: [taskOccurrences.taskId, taskOccurrences.date],
        set: { status: "done" },
      });
  } else {
    await db
      .delete(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.taskId, taskId),
          eq(taskOccurrences.date, date)
        )
      );
  }

  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const userId = await requireUserId();
  const [row] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ googleEventId: tasks.googleEventId });

  if (row?.googleEventId) {
    try {
      await deleteTaskEvent(userId, row.googleEventId);
    } catch (e) {
      console.error("Google Calendar event o'chirish xatosi:", e);
    }
  }

  revalidatePath("/tasks");
}
