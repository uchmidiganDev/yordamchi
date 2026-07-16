# Sprint 2 — DB, Bekend, Avtorizatsiya va CRUD

> **Bosqich:** 2/4
> **Fokus:** Ma'lumotlar bazasi, backend (API), autentifikatsiya va to'liq CRUD.
> **Asos:** Sprint 1 ekranlari endi haqiqiy ma'lumot bilan ishlaydi.

---

## 1. Maqsad

Ilovaning "jonli" bo'lishini ta'minlash: ma'lumotlar bazasini qurish, backend
mantiqini yozish, Telegram orqali kirish (auth) va maqsad/vazifalar ustida
to'liq CRUD (yaratish, o'qish, tahrirlash, o'chirish) amallarini ishga tushirish.
Sprint 1'dagi mock ma'lumot haqiqiy baza bilan almashtiriladi.

---

## 2. Ma'lumotlar bazasi

- **Baza:** PostgreSQL (Neon — bepul tarif).
- **ORM:** Drizzle ORM + migratsiyalar.

### Jadvallar
| Jadval | Vazifasi |
|--------|----------|
| `users` | Foydalanuvchi, Telegram id, TZ, tahlil vaqtlari, Google token. |
| `goals` | Maqsadlar (title, description, deadline, status). |
| `tasks` | Vazifalar (type, date, time, duration, priority, status, recurrence_rule). |
| `task_occurrences` | Takrorlanuvchi vazifalarning har kungi holati. |
| `analyses` | AI tahlillari tarixi (keyingi sprintda to'ladi, ammo sxema shu yerda). |

> To'liq ustunlar PRD.md 5-bo'limida keltirilgan.

---

## 3. Autentifikatsiya

- **Kutubxona:** Auth.js (NextAuth).
- **Asosiy kirish:** Telegram Login Widget → foydalanuvchi `telegram_id` bo'yicha yaratiladi/topiladi.
- **Google OAuth:** kalendar uchun ulash imkoni (refresh token `users.google_refresh_token` ga saqlanadi). Ulanishning o'zi shu sprintda, ammo kalendar sinxron mantiqi Sprint 3'da.
- Sessiya boshqaruvi, himoyalangan sahifalar (login qilmagan foydalanuvchi faqat login ko'radi).
- Server tomonda foydalanuvchini aniqlash (har so'rovda sessiyadan `user_id`).

---

## 4. Backend / API

- **Yondashuv:** Next.js Server Actions yoki API Routes (Vercel serversiz funksiyalar).
- Barcha amallar joriy foydalanuvchi bilan chegaralangan (faqat o'z ma'lumoti).

### CRUD amallari
| Resurs | Amallar |
|--------|---------|
| Maqsad | yaratish, ro'yxat, bitta o'qish, tahrirlash, o'chirish (yoki arxivlash). |
| Vazifa | yaratish (bir martalik/takrorlanuvchi), ro'yxat (filtrlar: bugun, sana bo'yicha), tahrirlash, holatni o'zgartirish, o'chirish. |
| Occurrence | takrorlanuvchi vazifa uchun kunlik holatni belgilash (bajarildi/o'tkazib yuborildi). |
| Sozlamalar | tahlil vaqtlari, vaqt mintaqasini yangilash. |

- Takrorlanuvchi vazifalar uchun tegishli kunga occurrence yaratish/olish logikasi.
- Validatsiya (server tomonда): majburiy maydonlar, sana/vaqt formati.

---

## 5. Frontendni ulash

- Sprint 1 ekranlaridagi mock ma'lumot haqiqiy API/Server Action bilan almashtiriladi.
- Yuklanish (loading), xato (error) va bo'sh holatlar haqiqiy ma'lumotga bog'lanadi.
- Optimistik yangilanish (checkbox bosilganda darhol ko'rinish) — ixtiyoriy, lekin tavsiya etiladi.

---

## 6. Vazifalar (Tasklar)

- [x] Neon Postgres yaratish va ulash.
- [x] Drizzle sxema + migratsiyalar (`users`, `goals`, `tasks`, `task_occurrences`, `analyses`) — `users`, `login_tokens`, `goals`, `tasks` jadvallari (hamda `cards`, `expenses`) migratsiya (`drizzle/0001_nosy_human_torch.sql`) bilan Neon'ga qo'llandi; `task_occurrences` va `analyses` jadvallari hamda `tasks.recurrence` ustuni (enum: none/daily/weekly/monthly) migratsiya `drizzle/0003_dazzling_komodo.sql` orqali qo'shildi va Neon'ga qo'llandi.
- [x] Auth.js — Telegram Login integratsiyasi. **Deviatsiya:** Auth.js (NextAuth) + Telegram Login Widget o'rniga Telegram bot deeplink (`/start` orqali) + custom JWT sessiya (`jose`, httpOnly cookie) yondashuvi qo'llanildi — sabab: foydalanuvchi faqat o'zining Telegram ID'si (8172404961) orqali kirishni talab qildi, bu botning `/start` handlerida to'g'ridan-to'g'ri tekshiriladi.
- [x] Google OAuth ulash oqimi (token saqlash). `src/lib/google-oauth.ts` (manual `fetch` bilan, `googleapis` paketi ishlatilmadi) + `/api/auth/google/start` va `/api/auth/google/callback` route'lari; sozlamalar sahifasida "Ulash"/"Uzish" tugmalari; `users.googleRefreshToken` saqlash. Foydalanuvchi tomonidan qilinishi kerak: Google Cloud Console'dan OAuth credentials olib `.env.local` va Vercel env'ga qo'shish, Google Calendar API'ni yoqish.
- [x] Himoyalangan sahifalar / sessiya.
- [x] Maqsad CRUD (API + frontend ulash). Server Actions (`src/lib/actions/goals.ts`) + `/` sahifasida to'liq CRUD interfeys (yaratish, tahrirlash, o'chirish, progress, holat) ishlaydi va real create/delete oqimi sinovdan o'tkazilgan.
- [x] Vazifa CRUD + takrorlanuvchi occurrence logikasi — bir martalik vazifa CRUD to'liq ishlaydi; takrorlanuvchi vazifa uchun `tasks.recurrence` (none/daily/weekly/monthly) va `task_occurrences` jadvali qo'shildi; `src/lib/actions/tasks.ts`da `toggleOccurrence()` funksiyasi takrorlanuvchi vazifaning bugungi holatini `task_occurrences` jadvaliga upsert/delete qiladi; `listTasksWithGoal` bugungi occurrence holatini (`todayDone`) qaytaradi; UI (`tasks-client.tsx`): forma'da "Takrorlanish" tanlovi, takrorlanuvchi vazifalar alohida "Takrorlanuvchi (bugun)" bo'limida, `recurTag` badge.
- [x] Sozlamalar (vaqt, TZ) saqlash. Sprint 1 dizaynidagi "E9 Sozlamalar" ekrani asosida qo'shildi (`src/app/(app)/sozlamalar/`): Profil, Tahlil vaqtlari (ertalabki/kechqurungi + vaqt mintaqasi) va Google kalendar (disabled, "Tez orada") bo'limlari, `src/lib/actions/settings.ts` orqali `users` jadvaliga (`name`, `timezone`, `morningTime`, `eveningTime`) saqlanadi; `nav.tsx`ga 6-tab sifatida qo'shildi. Preview'da saqlash va DB persistence tekshirilgan.
- [x] Server tomon validatsiya — sana/vaqt formati (`parseDueAt`, noto'g'ri bo'lsa xatolik), `priority` va `recurrence` qiymatlari tekshiriladi; majburiy maydon, login token amal qilish muddati va webhook secret tekshiruvi ham mavjud.

---

## 7. Deliverable (Aniq natija)

Foydalanuvchi Telegram orqali kiradigan, o'z maqsad va vazifalarini haqiqiy
bazada yaratadigan/tahrirlaydigan/o'chiradigan ishlaydigan ilova. Ma'lumot
qayta yuklashda saqlanib qoladi. Google akkaunt ulash imkoni mavjud (sinxron
keyingi sprintда).

---

## 8. Tayyorlik mezoni (Definition of Done)

- [x] Foydalanuvchi Telegram orqali kirib, sessiya oladi.
- [x] Maqsad yaratish/tahrirlash/o'chirish ishlaydi va bazada saqlanadi.
- [x] Bir martalik va takrorlanuvchi vazifa yaratiladi, tahrirlanadi, o'chiriladi. Bir martalik va takrorlanuvchi (none/daily/weekly/monthly) vazifalar to'liq ishlaydi.
- [x] Vazifa/occurrence holati (bajarildi/o'tkazildi) belgilanadi va saqlanadi. Bir martalik vazifa `tasks.status` orqali, takrorlanuvchi vazifa bugungi holati `task_occurrences` jadvaliga `toggleOccurrence()` orqali saqlanadi.
- [x] Har foydalanuvchi faqat o'z ma'lumotini ko'radi (izolyatsiya). Barcha Server Actions `requireUserId()` orqali joriy foydalanuvchiga scope qilingan.
- [x] Google akkaunt ulanadi va refresh token saqlanadi.
- [x] Sozlamalar (tahlil vaqtlari, TZ) saqlanadi.
- [x] Barcha ekranlar mock emas, haqiqiy ma'lumot bilan ishlaydi. Maqsad, Vazifa, Xarajat, Tahlil, Sozlamalar sahifalari real DB bilan ishlaydi. AI sahifasi ataylab Sprint 3'ga qoldirilgan (kelishilgan).

---

## 9. Ushbu sprintga KIRMAYDI

- ❌ AI / Gemini tahlili.
- ❌ Google Calendar bilan haqiqiy sinxronizatsiya (faqat ulash).
- ❌ Telegram avtomatik xabar yuborish.

---

## Hisobot

- **2026-07-14** — Next.js 16 (App Router, TypeScript, Turbopack) loyiha asosi o'rnatildi va Neon Postgres'ga Drizzle ORM orqali ulandi (`src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`); hozircha faqat `users` va `login_tokens` jadvallari yaratilib migratsiya qo'llandi (`drizzle/0000_famous_inertia.sql`). Telegram orqali kirish oqimi to'liq ishga tushirildi: grammY bot (`src/lib/telegram-bot.ts`) `/start` komandasida faqat `ALLOWED_TELEGRAM_ID` (8172404961) ga ruxsat beradi, deeplink token orqali tasdiqlaydi; sessiya `jose` JWT + httpOnly cookie (`src/lib/session.ts`) orqali boshqariladi; `src/proxy.ts` himoyalangan sahifalarni sessiyasiz foydalanuvchidan `/login`ga yo'naltiradi. API route'lar qo'shildi: `/api/telegram/webhook`, `/api/auth/telegram/start`, `/api/auth/telegram/status`, `/api/auth/logout`. `/login` va bosh sahifa (`/`) skeleton ko'rinishida ishlaydi. Vercel (`yordamchi-3upk`) production environment o'zgaruvchilari (DATABASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, ALLOWED_TELEGRAM_ID, SESSION_SECRET, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL) sozlandi. Auth.js/Telegram Login Widget o'rniga deeplink+JWT yondashuvi qo'llanilgani yuqorida "Vazifalar" bo'limida deviatsiya sifatida qayd etildi (qaror `CLAUDE.md`da ham yozilgan). Maqsad/Vazifa CRUD, Google OAuth, sozlamalar saqlash va to'liq 5 jadvalli sxema hali bajarilmagan — keyingi ishga qoldirildi.
- **2026-07-16** — DB sxemasiga `goals`, `tasks`, `cards`, `expenses` jadvallari qo'shildi (migratsiya `drizzle/0001_nosy_human_torch.sql` Neon'ga qo'llandi). Sprint 1'da tayyorlangan dizayn maketi asosida dizayn tokenlari (`src/app/(app)/tokens.css`) va umumiy UI komponentlar (`src/components/ui/`: Button, Card, ProgressBar, StatusTag, Input, Sheet, Segmented, icons) yaratildi; CSS Modules + tokenlar yondashuvi qo'llanildi (Tailwind emas). Responsiv app shell (`src/app/(app)/layout.tsx`, `nav.tsx` — mobil pastki tab-bar / desktop yon sidebar) qurildi, eski `src/app/page.tsx` va `logout-button.tsx` yangi `(app)` route group bilan almashtirildi. Har bir resurs uchun `requireUserId()` bilan foydalanuvchiga scope qilingan Server Actions (`src/lib/actions/{goals,tasks,cards,expenses}.ts`) yozildi. To'liq CRUD interfeysli 5 sahifa ishga tushirildi: `/` (Maqsadlar), `/tasks` (Vazifalar, guruhlangan ro'yxat), `/xarajat` (Kartalar va Xarajatlar — PRD'da yo'q, foydalanuvchi so'rovi bilan qo'shilgan), `/ai` va `/tahlil` (ikkalasi ham statik namuna ma'lumot bilan — haqiqiy mantiq Sprint 3'ga qoldirilgan, kelishilgan). Test ma'lumotlari uchun `scripts/seed.ts` (`npm run seed`) yaratildi. `npm run build` muvaffaqiyatli o'tdi, preview orqali barcha 5 sahifa va Goals resursi uchun haqiqiy create/delete CRUD oqimi sinovdan o'tkazildi. Google OAuth ulash, sozlamalar saqlash, takrorlanuvchi vazifa/occurrence mantiqi va `task_occurrences`/`analyses` jadvallari hali bajarilmagan.
- **2026-07-16** — Google OAuth ulash oqimi amalga oshirildi (commit ae02fd5): `src/lib/google-oauth.ts` (`googleapis` paketi ishlatilmay, to'g'ridan-to'g'ri `fetch` bilan Google OAuth2 token endpoint'lari chaqiriladi), `/api/auth/google/start` (OAuth redirect URL generatsiyasi) va `/api/auth/google/callback` (code ↔ token almashtirish va `users.googleRefreshToken` saqlash) API route'lari qo'shildi; sozlamalar sahifasiga "Google Calendar: Ulash / Uzish" tugmalari qo'shildi. Telegram bot Paynet o'tkazma chekini avtomatik parse qilib xarajat sifatida saqlash funksiyasi qo'shildi: `src/lib/paynet-receipt.ts` (matndan merchant, summa, sana, tranzaksiya ID ni regex orqali ajratib oladi), `src/lib/expense-from-receipt.ts` (parse natijasidan expense yaratadi), `src/lib/telegram-bot.ts` kengaytirildi (oddiy matn xabar kelganda Paynet cheki sifatida tanib, expenses jadvaliga saqlaydi); takror saqlashni oldini olish uchun `expenses.external_ref` ustuni va `drizzle/0002_*.sql` migratsiyasi qo'shildi.
- **2026-07-16** — Sprint 2 to'liq tugallandi (commit 81f0b4e). `task_occurrences` va `analyses` jadvallari qo'shildi (migratsiya `drizzle/0003_dazzling_komodo.sql`, Neon'ga qo'llandi); `tasks` jadvaliga `recurrence` ustuni (enum: none/daily/weekly/monthly) qo'shildi; yangi enumlar: `task_recurrence`, `occurrence_status` (done/skipped), `analysis_kind` (morning/evening/manual). Takrorlanuvchi vazifa + occurrence mantiqi to'liq ishlaydi: `toggleOccurrence()` bugungi holatni `task_occurrences` ga upsert/delete qiladi, `listTasksWithGoal` `todayDone` qaytaradi; UI'da "Takrorlanish" tanlovi, alohida "Takrorlanuvchi (bugun)" bo'limi, `recurTag` badge. Server tomon validatsiya kuchaytirildi: sana/vaqt formati (`parseDueAt`), `priority` va `recurrence` qiymatlari tekshiriladi. Maqsad, Vazifa, Xarajat, Tahlil real DB bilan ishlaydi; AI sahifasi kelishuvga ko'ra Sprint 3'ga qoldirilgan.
- **2026-07-16** — Sprint 1 dizaynida rejalashtirilgan "E9 Sozlamalar" ekrani qo'shildi: `src/app/(app)/sozlamalar/page.tsx` (server component) + `sozlamalar-client.tsx` (Profil, Tahlil vaqtlari — ertalabki/kechqurungi vaqt va vaqt mintaqasi, Google kalendar bo'limi disabled "Tez orada", Saqlash va Hisobdan chiqish tugmalari) + `sozlamalar.module.css`; `src/lib/actions/settings.ts` `updateSettings` server action orqali `users` jadvalidagi mavjud (lekin ilgari ishlatilmagan) `timezone`, `morningTime`, `eveningTime` maydonlarini yangilaydi va `revalidatePath("/sozlamalar")` qiladi; `src/components/ui/icons.tsx`ga `SettingsIcon`, `nav.tsx`ga 6-tab sifatida qo'shildi. Preview brauzerda saqlash, sahifa qayta yuklanganda DB'da saqlanib qolishi va hidratsiya/konsol xatosi yo'qligi tasdiqlandi.
- **2026-07-16** — Telegram bot PDF chek qo'llab-quvvatlashi qo'shildi (commit af5e7dc): `src/lib/pdf-text.ts` yaratildi (`unpdf` kutubxonasi orqali PDF baytlaridan matn ajratadigan `extractPdfText` funksiyasi; serverless-mos `pdf.js` asosida, `canvas` bog'liqligi yo'q); `src/lib/telegram-bot.ts`da yangi `bot.on("message:document")` handler qo'shildi — MIME turi `application/pdf` yoki `.pdf` kengaytmali fayl kelganda Telegram File API orqali yuklab, `extractPdfText` bilan matnini ajratadi va mavjud `handleReceiptText` yordamchisiga beradi; matn va PDF ishlash mantiqi umumiy `handleReceiptText` funksiyasiga ajratildi; `next.config.ts`ga `serverExternalPackages: ["unpdf"]` qo'shildi; `unpdf` paketi o'rnatildi. Node muhitida o'zbekcha belgilar bilan PDF matnini to'g'ri ajratishi tasdiqlandi. To'liq bot oqimi Vercel webhook'da sinovdan o'tkaziladi.
