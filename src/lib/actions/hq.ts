"use server";

// "Yordamchi HQ" sahifasi uchun — tizimning har bir bo'limi (Telegram, Kod,
// Rasm va h.k.) qanchalik "band" ekanini HAQIQIY, jonli bazadan o'qiydi.
// Claude Artifact orqali bir martalik "surat" sifatida sinalgan edi, lekin
// Artifact preview muhitida beqaror bo'lib chiqqani sabab shu haqiqiy
// ilova sahifasiga (har safar chaqirilganda qayta o'qiydigan, chinakam
// jonli) ko'chirildi.

import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  analyses,
  businessMessages,
  codeReviews,
  goals,
  groupModerationLog,
  groupSettings,
  knowledgeEntries,
  miniAppMessages,
  tasks,
  telegramBots,
  telegramMessages,
  websiteAnalyses,
} from "@/db/schema";
import { requireUserId } from "./require-user";

export type HqSnapshot = {
  telegramMessages: number;
  telegramBotsEnabled: number;
  businessMessages: number;
  groupModerationActions: number;
  groupsWithAntispamOn: number;
  websiteAnalyses: number;
  tasksTotal: number;
  tasksDone: number;
  goalsActive: { title: string; progress: number }[];
  analysesTotal: number;
  analysesMorning: number;
  analysesEvening: number;
  analysesManual: number;
  codeReviews: number;
  knowledgeEntries: number;
  miniAppMessages: number;
};

export async function getHqSnapshot(): Promise<HqSnapshot> {
  const userId = await requireUserId();

  const [
    tgMsgCount,
    tgBotsCount,
    bizMsgCount,
    modLogCount,
    antispamOnCount,
    siteAnalysesCount,
    tasksAll,
    goalsActiveRows,
    analysesAll,
    codeReviewCount,
    knowledgeCount,
    miniAppCount,
  ] = await Promise.all([
    db.select({ c: count() }).from(telegramMessages).where(eq(telegramMessages.userId, userId)),
    db.select({ c: count() }).from(telegramBots).where(and(eq(telegramBots.userId, userId), eq(telegramBots.enabled, true))),
    db.select({ c: count() }).from(businessMessages).where(eq(businessMessages.userId, userId)),
    db.select({ c: count() }).from(groupModerationLog),
    db.select({ c: count() }).from(groupSettings).where(eq(groupSettings.antispamEnabled, true)),
    db.select({ c: count() }).from(websiteAnalyses).where(eq(websiteAnalyses.userId, userId)),
    db.select({ status: tasks.status }).from(tasks).where(eq(tasks.userId, userId)),
    db
      .select({ title: goals.title, progress: goals.progress })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.status, "active"))),
    db.select({ kind: analyses.kind }).from(analyses).where(eq(analyses.userId, userId)),
    db.select({ c: count() }).from(codeReviews).where(eq(codeReviews.userId, userId)),
    db.select({ c: count() }).from(knowledgeEntries).where(eq(knowledgeEntries.userId, userId)),
    db.select({ c: count() }).from(miniAppMessages).where(eq(miniAppMessages.userId, userId)),
  ]);

  return {
    telegramMessages: tgMsgCount[0].c,
    telegramBotsEnabled: tgBotsCount[0].c,
    businessMessages: bizMsgCount[0].c,
    groupModerationActions: modLogCount[0].c,
    groupsWithAntispamOn: antispamOnCount[0].c,
    websiteAnalyses: siteAnalysesCount[0].c,
    tasksTotal: tasksAll.length,
    tasksDone: tasksAll.filter((t) => t.status === "done").length,
    goalsActive: goalsActiveRows,
    analysesTotal: analysesAll.length,
    analysesMorning: analysesAll.filter((a) => a.kind === "morning").length,
    analysesEvening: analysesAll.filter((a) => a.kind === "evening").length,
    analysesManual: analysesAll.filter((a) => a.kind === "manual").length,
    codeReviews: codeReviewCount[0].c,
    knowledgeEntries: knowledgeCount[0].c,
    miniAppMessages: miniAppCount[0].c,
  };
}
