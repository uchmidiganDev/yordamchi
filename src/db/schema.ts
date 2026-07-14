import {
  pgTable,
  uuid,
  bigint,
  text,
  timestamp,
  time,
  pgEnum,
} from "drizzle-orm/pg-core";

export const loginTokenStatus = pgEnum("login_token_status", [
  "pending",
  "confirmed",
  "rejected",
]);

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type LoginToken = typeof loginTokens.$inferSelect;
