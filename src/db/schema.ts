import {
  pgTable,
  uuid,
  bigint,
  text,
  timestamp,
  time,
  date,
  integer,
  boolean,
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
  // AI Assistant uchun moslashtirilgan system prompt. Bo'sh bo'lsa
  // ilovadagi standart prompt ishlatiladi (src/lib/actions/assistant.ts).
  assistantSystemPrompt: text("assistant_system_prompt"),
  // AI Coding Assistant (Telegram) uchun moslashtirilgan qo'shimcha
  // ko'rsatma. Bo'sh bo'lsa standart yo'riqnoma ishlatiladi
  // (src/lib/code-assistant.ts).
  codeAssistantSystemPrompt: text("code_assistant_system_prompt"),
  // Telegram Business ulanishi (shaxsiy akkauntga botni "AI Assistant"
  // sifatida ulash). Telegram'dan kelgan `business_connection` yangilanishi
  // orqali yoziladi (src/lib/telegram-bot.ts).
  businessConnectionId: text("business_connection_id"),
  businessConnectionEnabled: boolean("business_connection_enabled")
    .notNull()
    .default(false),
  // Telefon bo'limi (PSTN/Telnyx rejasi): qo'ng'iroqqa javob berayotgan AI
  // shaxs (persona) va AI javob berish holati. 2026-07-22'da UI ("/telefon"
  // sahifasi) olib tashlandi va o'rniga "/shaxsiy-ai" (Telegram Business
  // orqali) qo'yildi — bu ustunlar/`aiPersonas` jadvali ATAYLAB o'chirilmadi,
  // chunki `src/app/api/telnyx/webhook/route.ts` hali shu ma'lumotga
  // (persona nomi) tayanadi (Telnyx dormant, lekin kod ishlaydi).
  activePersonaId: uuid("active_persona_id"),
  phoneAiEnabled: boolean("phone_ai_enabled").notNull().default(false),
  // "/shaxsiy-ai" sahifasi: Telegram Business orqali shaxsiy akkauntga
  // kelgan xabarlarda qaysi qo'shimcha imkoniyatlar faol ekanini boshqaradi
  // (src/lib/telegram-bot.ts'dagi business_message handleri).
  businessVoiceReplyEnabled: boolean("business_voice_reply_enabled")
    .notNull()
    .default(true),
  businessLinkAnalysisEnabled: boolean("business_link_analysis_enabled")
    .notNull()
    .default(true),
  businessVideoDownloadEnabled: boolean("business_video_download_enabled")
    .notNull()
    .default(true),
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
  // Google Calendar'dagi mos event ID'si (chiqish sinxroni uchun).
  googleEventId: text("google_event_id"),
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

// AI Assistant uchun bilim bazasi yozuvlari — admin panel orqali
// kiritiladi va Telegram bot javoblarida birinchi manba sifatida ishlatiladi.
export const knowledgeEntries = pgTable("knowledge_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// AI Coding Assistant uchun bilim bazasi (loyiha konvensiyalari, coding
// standartlari va h.k.) — admin panel (/kod-yordamchi) orqali kiritiladi va
// Telegram botdagi kod tahlili/fix/optimize javoblarida kontekst sifatida
// ishlatiladi. Umumiy `knowledgeEntries`dan alohida — foydalanuvchi ataylab
// alohida bo'lim so'radi.
export const codeKnowledgeEntries = pgTable("code_knowledge_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Chat bo'yicha oxirgi kod tahlili/natija — "Fix"/"Explain"/"Optimize" va
// boshqa buyruqlar shu yozuvdagi kodga nisbatan ishlaydi va har safar
// natija bilan yangilanadi (zanjir davom etadi: Fix -> Optimize -> Explain
// ketma-ketligi oldingi natija ustida ishlaydi).
export const codeReviews = pgTable("code_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
  language: text("language").notNull(),
  code: text("code").notNull(),
  review: text("review").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Guruh (Telegram group/supergroup) bo'yicha anti-spam sozlamasi. Yozuv
// birinchi xabar kelganda "lazy" yaratiladi (bot guruhga qo'shilgan payt
// alohida event kutilmaydi) — shu sabab userId majburiy emas, chunki qaysi
// ilova egasi tegishli ekanini bilish shart emas (single-tenant, faqat bitta
// egasi bor).
export const groupSettings = pgTable("group_settings", {
  chatId: bigint("chat_id", { mode: "bigint" }).primaryKey(),
  antispamEnabled: boolean("antispam_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Guruhda foydalanuvchi bo'yicha ogohlantirish soni — belgilangan chegaraga
// yetsa mute/banga eskalatsiya qilinadi (src/lib/group-moderation.ts).
export const groupWarnings = pgTable(
  "group_warnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
    telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.chatId, t.telegramUserId)]
);

// Flood/takroriy xabar aniqlash uchun guruhdagi so'nggi xabarlar jurnali —
// vaqt oynasi bo'yicha so'rovga tutiladi (src/lib/group-moderation.ts).
// Eslatma: eski yozuvlar avtomatik tozalanmaydi (MVP) — juda faol guruhda
// jadval o'sib boradi, kelajakda davriy tozalash qo'shilishi mumkin.
export const groupRecentMessages = pgTable("group_recent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
  telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
  textHash: text("text_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Moderatsiya harakatlari jurnali — Statistika/`/logs` (Stage 2) uchun
// ma'lumot shu yerdan olinadi. Harakat Stage 1'da yozib boriladi, ko'rish
// interfeysi (admin panel, `/logs`) Stage 2'da qo'shiladi.
export const groupModerationLog = pgTable("group_moderation_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
  telegramUserId: bigint("telegram_user_id", { mode: "bigint" }),
  telegramUsername: text("telegram_username"),
  action: text("action").notNull(), // deleted | warned | muted | banned
  reason: text("reason").notNull(),
  messageText: text("message_text"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Guruhda AI Assistant (mention/reply/`/ai`) suhbat tarixi — "AI Memory"
// talabi shu jadval orqali amalga oshiriladi (businessMessages'ga o'xshash,
// lekin guruh konteksti uchun).
export const groupMessages = pgTable("group_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
  fromName: text("from_name"),
  fromUsername: text("from_username"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Telefon bo'limidagi AI shaxslar (personas) — har biri o'z nomi va System
// Prompt'iga ega, telefon qo'ng'irog'ida qaysi biri javob berishini
// `users.activePersonaId` belgilaydi.
export const aiPersonas = pgTable("ai_personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Foydalanuvchi UI orqali qo'shgan qo'shimcha AI botlari (masalan
// @yusuf_chatbot_bot). Har biri /telegram sahifasida boshqariladi
// (yoqish/o'chirish, o'chirish). helperizim_bot (shaxsiy bot) bu jadvalga
// kirmaydi — u src/lib/telegram-bot.ts'da alohida boshqariladi.
export const telegramBots = pgTable("telegram_bots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  username: text("username").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Botlarga kelgan xabarlar va berilgan javoblar jurnali. `chatId` bo'yicha
// guruhlab, oldingi bir nechta xabar suhbat konteksti sifatida keyingi AI
// chaqiruviga uzatiladi (src/lib/assistant.ts).
export const telegramMessages = pgTable("telegram_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => telegramBots.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
  fromName: text("from_name"),
  fromUsername: text("from_username"),
  text: text("text").notNull(),
  answer: text("answer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Telegram Business orqali shaxsiy akkauntga kelgan xabarlar jurnali.
// `chatId` (mijoz bilan suhbat) bo'yicha guruhlanadi va oldingi xabarlar
// keyingi AI chaqiruviga kontekst sifatida uzatiladi — telegram_messages'ga
// o'xshash, lekin botId'ga bog'liq emas (helperizim_bot telegram_bots
// jadvaliga kirmaydi).
export const businessMessages = pgTable("business_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
  fromName: text("from_name"),
  fromUsername: text("from_username"),
  text: text("text").notNull(),
  answer: text("answer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// AI Website Analyzer: chat bo'yicha oxirgi tahlil natijasi saqlanadi — "To'g'rila"
// so'ralganda shu yozuvdagi HTML+tahlil asosida yaxshilangan kod yaratiladi
// (src/lib/website-analyzer.ts). `userId` — doim ilova egasi (single-tenant
// naqsh, businessMessages/telegramMessages'dagi kabi), `chatId` — haqiqiy
// Telegram suhbat, kim yozganidan qat'i nazar.
export const websiteAnalyses = pgTable("website_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
  url: text("url").notNull(),
  html: text("html").notNull(),
  analysis: text("analysis").notNull(),
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
export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert;
export type AiPersona = typeof aiPersonas.$inferSelect;
export type NewAiPersona = typeof aiPersonas.$inferInsert;
export type TelegramBot = typeof telegramBots.$inferSelect;
export type NewTelegramBot = typeof telegramBots.$inferInsert;
export type TelegramMessage = typeof telegramMessages.$inferSelect;
export type NewTelegramMessage = typeof telegramMessages.$inferInsert;
export type BusinessMessage = typeof businessMessages.$inferSelect;
export type NewBusinessMessage = typeof businessMessages.$inferInsert;
