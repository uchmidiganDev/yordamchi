import {
  pgTable,
  uuid,
  bigint,
  text,
  timestamp,
  time,
  date,
  integer,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const loginTokenStatus = pgEnum("login_token_status", [
  "pending",
  "confirmed",
  "rejected",
]);

export const goalStatus = pgEnum("goal_status", ["active", "done"]);

export const taskPriority = pgEnum("task_priority", ["high", "mid", "low"]);

export const taskStatus = pgEnum("task_status", ["pending", "done"]);

export const taskRecurrence = pgEnum("task_recurrence", [
  "none",
  "daily",
  "weekly",
  "monthly",
]);

export const occurrenceStatus = pgEnum("occurrence_status", [
  "done",
  "skipped",
]);

export const analysisKind = pgEnum("analysis_kind", [
  "morning",
  "evening",
  "manual",
]);

export const cardBrand = pgEnum("card_brand", ["uzcard", "humo"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramId: bigint("telegram_id", { mode: "bigint" }).notNull().unique(),
  telegramUsername: text("telegram_username"),
  name: text("name"),
  googleRefreshToken: text("google_refresh_token"),
  timezone: text("timezone").notNull().default("Asia/Tashkent"),
  morningTime: time("morning_time").notNull().default("08:00"),
  eveningTime: time("evening_time").notNull().default("21:00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Telegram deep-link orqali kirish uchun vaqtinchalik login tokenlari.
export const loginTokens = pgTable("login_tokens", {
  token: text("token").primaryKey(),
  status: loginTokenStatus("status").notNull().default("pending"),
  telegramId: bigint("telegram_id", { mode: "bigint" }),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  progress: integer("progress").notNull().default(0),
  status: goalStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  priority: taskPriority("priority").notNull().default("mid"),
  status: taskStatus("status").notNull().default("pending"),
  recurrence: taskRecurrence("recurrence").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Takrorlanuvchi vazifalarning har kungi holati. Bir martalik vazifalar bu
// jadvaldan foydalanmaydi — ular to'g'ridan-to'g'ri `tasks.status` orqali
// boshqariladi.
export const taskOccurrences = pgTable(
  "task_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: occurrenceStatus("status").notNull().default("done"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    taskDateUnique: unique("task_occurrences_task_date_unique").on(
      t.taskId,
      t.date
    ),
  })
);

// AI tahlillari tarixi. Sxema shu sprintda tayyorlanadi; to'ldirish Sprint 3'da.
export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: analysisKind("kind").notNull().default("manual"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  numberMasked: text("number_masked").notNull(),
  brand: cardBrand("brand").notNull().default("uzcard"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  externalRef: text("external_ref"),
  spentAt: timestamp("spent_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type LoginToken = typeof loginTokens.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskOccurrence = typeof taskOccurrences.$inferSelect;
export type NewTaskOccurrence = typeof taskOccurrences.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
