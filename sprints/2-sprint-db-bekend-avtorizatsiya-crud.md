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
- [ ] Drizzle sxema + migratsiyalar (`users`, `goals`, `tasks`, `task_occurrences`, `analyses`) — **qisman bajarildi:** `users`, `login_tokens`, `goals`, `tasks` jadvallari (hamda rejada bo'lmagan `cards`, `expenses` — Xarajat funksiyasi uchun) yaratilib migratsiya (`drizzle/0001_nosy_human_torch.sql`) Neon bazasiga qo'llandi; `task_occurrences` (takrorlanuvchi vazifa) va `analyses` (AI tahlil tarixi) hali qolgan — Sprint 3'ga qoldiriladi.
- [x] Auth.js — Telegram Login integratsiyasi. **Deviatsiya:** Auth.js (NextAuth) + Telegram Login Widget o'rniga Telegram bot deeplink (`/start` orqali) + custom JWT sessiya (`jose`, httpOnly cookie) yondashuvi qo'llanildi — sabab: foydalanuvchi faqat o'zining Telegram ID'si (8172404961) orqali kirishni talab qildi, bu botning `/start` handlerida to'g'ridan-to'g'ri tekshiriladi.
- [ ] Google OAuth ulash oqimi (token saqlash).
- [x] Himoyalangan sahifalar / sessiya.
- [x] Maqsad CRUD (API + frontend ulash). Server Actions (`src/lib/actions/goals.ts`) + `/` sahifasida to'liq CRUD interfeys (yaratish, tahrirlash, o'chirish, progress, holat) ishlaydi va real create/delete oqimi sinovdan o'tkazilgan.
- [ ] Vazifa CRUD + takrorlanuvchi occurrence logikasi — **qisman bajarildi:** bir martalik vazifa CRUD (`src/lib/actions/tasks.ts`, `/tasks` sahifasi: muddati o'tgan/bugun/keyingi/muddatsiz/bajarilgan guruhlash, maqsadga bog'lash, muhimlik) ishlaydi; takrorlanuvchi vazifa va occurrence mantiqi hali yo'q.
- [x] Sozlamalar (vaqt, TZ) saqlash. Sprint 1 dizaynidagi "E9 Sozlamalar" ekrani asosida qo'shildi (`src/app/(app)/sozlamalar/`): Profil, Tahlil vaqtlari (ertalabki/kechqurungi + vaqt mintaqasi) va Google kalendar (disabled, "Tez orada") bo'limlari, `src/lib/actions/settings.ts` orqali `users` jadvaliga (`name`, `timezone`, `morningTime`, `eveningTime`) saqlanadi; `nav.tsx`ga 6-tab sifatida qo'shildi. Preview'da saqlash va DB persistence tekshirilgan.
- [ ] Server tomon validatsiya. (Qisman: login token amal qilish muddati va webhook secret tekshiruvi, shuningdek Maqsad/Vazifa/Karta/Xarajat CRUD amallarida majburiy maydon (masalan bo'sh sarlavha) tekshiruvi qo'shildi; sana/vaqt format va occurrence validatsiyasi hali yo'q.)

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
- [ ] Bir martalik va takrorlanuvchi vazifa yaratiladi, tahrirlanadi, o'chiriladi. **Qisman:** bir martalik vazifa to'liq ishlaydi, takrorlanuvchi (recurrence) hali yo'q.
- [ ] Vazifa/occurrence holati (bajarildi/o'tkazildi) belgilanadi va saqlanadi. **Qisman:** vazifa holati (pending/done) belgilanadi va saqlanadi, lekin takrorlanuvchi occurrence tushunchasi hali yo'q.
- [x] Har foydalanuvchi faqat o'z ma'lumotini ko'radi (izolyatsiya). Barcha Server Actions `requireUserId()` orqali joriy foydalanuvchiga scope qilingan.
- [ ] Google akkaunt ulanadi va refresh token saqlanadi.
- [x] Sozlamalar (tahlil vaqtlari, TZ) saqlanadi.
- [ ] Barcha ekranlar mock emas, haqiqiy ma'lumot bilan ishlaydi. **Qisman:** Maqsadlar, Vazifalar va Xarajat sahifalari haqiqiy ma'lumot bilan ishlaydi; AI va Tahlil sahifalari ataylab statik namuna holatida qoldirilgan (haqiqiy mantiq Sprint 3'ga rejalashtirilgan).

---

## 9. Ushbu sprintga KIRMAYDI

- ❌ AI / Gemini tahlili.
- ❌ Google Calendar bilan haqiqiy sinxronizatsiya (faqat ulash).
- ❌ Telegram avtomatik xabar yuborish.

---

## Hisobot

- **2026-07-14** — Next.js 16 (App Router, TypeScript, Turbopack) loyiha asosi o'rnatildi va Neon Postgres'ga Drizzle ORM orqali ulandi (`src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`); hozircha faqat `users` va `login_tokens` jadvallari yaratilib migratsiya qo'llandi (`drizzle/0000_famous_inertia.sql`). Telegram orqali kirish oqimi to'liq ishga tushirildi: grammY bot (`src/lib/telegram-bot.ts`) `/start` komandasida faqat `ALLOWED_TELEGRAM_ID` (8172404961) ga ruxsat beradi, deeplink token orqali tasdiqlaydi; sessiya `jose` JWT + httpOnly cookie (`src/lib/session.ts`) orqali boshqariladi; `src/proxy.ts` himoyalangan sahifalarni sessiyasiz foydalanuvchidan `/login`ga yo'naltiradi. API route'lar qo'shildi: `/api/telegram/webhook`, `/api/auth/telegram/start`, `/api/auth/telegram/status`, `/api/auth/logout`. `/login` va bosh sahifa (`/`) skeleton ko'rinishida ishlaydi. Vercel (`yordamchi-3upk`) production environment o'zgaruvchilari (DATABASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, ALLOWED_TELEGRAM_ID, SESSION_SECRET, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL) sozlandi. Auth.js/Telegram Login Widget o'rniga deeplink+JWT yondashuvi qo'llanilgani yuqorida "Vazifalar" bo'limida deviatsiya sifatida qayd etildi (qaror `CLAUDE.md`da ham yozilgan). Maqsad/Vazifa CRUD, Google OAuth, sozlamalar saqlash va to'liq 5 jadvalli sxema hali bajarilmagan — keyingi ishga qoldirildi.
- **2026-07-16** — DB sxemasiga `goals`, `tasks`, `cards`, `expenses` jadvallari qo'shildi (migratsiya `drizzle/0001_nosy_human_torch.sql` Neon'ga qo'llandi). Sprint 1'da tayyorlangan dizayn maketi asosida dizayn tokenlari (`src/app/(app)/tokens.css`) va umumiy UI komponentlar (`src/components/ui/`: Button, Card, ProgressBar, StatusTag, Input, Sheet, Segmented, icons) yaratildi; CSS Modules + tokenlar yondashuvi qo'llanildi (Tailwind emas). Responsiv app shell (`src/app/(app)/layout.tsx`, `nav.tsx` — mobil pastki tab-bar / desktop yon sidebar) qurildi, eski `src/app/page.tsx` va `logout-button.tsx` yangi `(app)` route group bilan almashtirildi. Har bir resurs uchun `requireUserId()` bilan foydalanuvchiga scope qilingan Server Actions (`src/lib/actions/{goals,tasks,cards,expenses}.ts`) yozildi. To'liq CRUD interfeysli 5 sahifa ishga tushirildi: `/` (Maqsadlar), `/tasks` (Vazifalar, guruhlangan ro'yxat), `/xarajat` (Kartalar va Xarajatlar — PRD'da yo'q, foydalanuvchi so'rovi bilan qo'shilgan), `/ai` va `/tahlil` (ikkalasi ham statik namuna ma'lumot bilan — haqiqiy mantiq Sprint 3'ga qoldirilgan, kelishilgan). Test ma'lumotlari uchun `scripts/seed.ts` (`npm run seed`) yaratildi. `npm run build` muvaffaqiyatli o'tdi, preview orqali barcha 5 sahifa va Goals resursi uchun haqiqiy create/delete CRUD oqimi sinovdan o'tkazildi. Google OAuth ulash, sozlamalar saqlash, takrorlanuvchi vazifa/occurrence mantiqi va `task_occurrences`/`analyses` jadvallari hali bajarilmagan.
- **2026-07-16** — Sprint 1 dizaynida rejalashtirilgan "E9 Sozlamalar" ekrani qo'shildi: `src/app/(app)/sozlamalar/page.tsx` (server component) + `sozlamalar-client.tsx` (Profil, Tahlil vaqtlari — ertalabki/kechqurungi vaqt va vaqt mintaqasi, Google kalendar bo'limi disabled "Tez orada", Saqlash va Hisobdan chiqish tugmalari) + `sozlamalar.module.css`; `src/lib/actions/settings.ts` `updateSettings` server action orqali `users` jadvalidagi mavjud (lekin ilgari ishlatilmagan) `timezone`, `morningTime`, `eveningTime` maydonlarini yangilaydi va `revalidatePath("/sozlamalar")` qiladi; `src/components/ui/icons.tsx`ga `SettingsIcon`, `nav.tsx`ga 6-tab sifatida qo'shildi. Preview brauzerda saqlash, sahifa qayta yuklanganda DB'da saqlanib qolishi va hidratsiya/konsol xatosi yo'qligi tasdiqlandi.
