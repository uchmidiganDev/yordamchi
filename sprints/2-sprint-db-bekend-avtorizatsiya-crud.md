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

- [ ] Neon Postgres yaratish va ulash.
- [ ] Drizzle sxema + migratsiyalar (`users`, `goals`, `tasks`, `task_occurrences`, `analyses`).
- [ ] Auth.js — Telegram Login integratsiyasi.
- [ ] Google OAuth ulash oqimi (token saqlash).
- [ ] Himoyalangan sahifalar / sessiya.
- [ ] Maqsad CRUD (API + frontend ulash).
- [ ] Vazifa CRUD + takrorlanuvchi occurrence logikasi.
- [ ] Sozlamalar (vaqt, TZ) saqlash.
- [ ] Server tomon validatsiya.

---

## 7. Deliverable (Aniq natija)

Foydalanuvchi Telegram orqali kiradigan, o'z maqsad va vazifalarini haqiqiy
bazada yaratadigan/tahrirlaydigan/o'chiradigan ishlaydigan ilova. Ma'lumot
qayta yuklashda saqlanib qoladi. Google akkaunt ulash imkoni mavjud (sinxron
keyingi sprintда).

---

## 8. Tayyorlik mezoni (Definition of Done)

- [ ] Foydalanuvchi Telegram orqali kirib, sessiya oladi.
- [ ] Maqsad yaratish/tahrirlash/o'chirish ishlaydi va bazada saqlanadi.
- [ ] Bir martalik va takrorlanuvchi vazifa yaratiladi, tahrirlanadi, o'chiriladi.
- [ ] Vazifa/occurrence holati (bajarildi/o'tkazildi) belgilanadi va saqlanadi.
- [ ] Har foydalanuvchi faqat o'z ma'lumotini ko'radi (izolyatsiya).
- [ ] Google akkaunt ulanadi va refresh token saqlanadi.
- [ ] Sozlamalar (tahlil vaqtlari, TZ) saqlanadi.
- [ ] Barcha ekranlar mock emas, haqiqiy ma'lumot bilan ishlaydi.

---

## 9. Ushbu sprintga KIRMAYDI

- ❌ AI / Gemini tahlili.
- ❌ Google Calendar bilan haqiqiy sinxronizatsiya (faqat ulash).
- ❌ Telegram avtomatik xabar yuborish.
