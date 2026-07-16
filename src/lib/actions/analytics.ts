"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { goals, tasks } from "@/db/schema";
import { requireUserId } from "./require-user";

const DAY_LABELS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Yak..6=Shan
  const diff = (day === 0 ? -6 : 1) - day; // Dushanbagacha
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function getAnalytics() {
  const userId = await requireUserId();

  const [userGoals, userTasks] = await Promise.all([
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
  ]);

  const monday = startOfWeek(new Date());
  const week = DAY_LABELS.map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayTasks = userTasks.filter((t) => t.dueAt && sameDay(new Date(t.dueAt), day));
    const doneCount = dayTasks.filter((t) => t.status === "done").length;
    const pct = dayTasks.length > 0 ? Math.round((doneCount / dayTasks.length) * 100) : 0;
    return { day: label, pct };
  });

  const goalBreakdown = userGoals
    .filter((g) => g.status === "active")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5)
    .map((g) => ({ title: g.title, progress: g.progress }));

  const doneTasks = userTasks.filter((t) => t.status === "done").length;
  const avgProgress =
    userGoals.length > 0
      ? Math.round(userGoals.reduce((sum, g) => sum + g.progress, 0) / userGoals.length)
      : 0;

  const stats = [
    { label: "Jami maqsadlar", value: String(userGoals.length) },
    { label: "Bajarilgan vazifalar", value: String(doneTasks) },
    { label: "O'rtacha bajarish", value: `${avgProgress}%` },
  ];

  return { week, goalBreakdown, stats };
}
