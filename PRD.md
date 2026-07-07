# PRD — Maqsad-Vazifa Boshqaruv Platformasi (AI yordamchi)

> **Hujjat holati:** Reja bosqichi (kod yozilmagan)
> **Sana:** 2026-07-07
> **Mahsulot turi:** Shaxsiy vosita (bitta foydalanuvchi uchun)
> **Kod nomi:** `yordamchi`

---

## 1. Maqsad (Vision)

Foydalanuvchining shaxsiy maqsadlari va kundalik vazifalarini bir joyda
boshqaradigan, har kuni AI (Google Gemini) yordamida tahlil qilib, ertangi
kunni rejalashtiradigan va Telegram orqali eslatma yuboradigan aqlli shaxsiy
yordamchi platforma.

Asosiy qiymat: foydalanuvchi shunchaki vazifa ro'yxatini emas, balki
**"bugun nima qildim, ertaga nima qilishim kerak"** degan savolga har kuni
avtomatik, aqlli javob oladi.

---

## 2. Muammo (Problem)

- Odatiy to-do ilovalari faqat ro'yxat saqlaydi — ular **tahlil qilmaydi**,
  maslahat bermaydi.
- Katta maqsadlar (masalan "Ingliz tilini o'rganish") kundalik amaliy
  qadamlarga bo'linmay qoladi.
- Foydalanuvchi qaysi vazifa orqada qolganini, qaysi maqsad sekin
  borayotganini o'zi kuzatishga ulgurmaydi.
- Rejalashtirish uchun kalendardagi bo'sh vaqtni hisobga olish qo'lda va
  zerikarli.
- Eslatmalar ko'pincha ilovadan tashqarida (Telegram'da) kerak, chunki
  odam kun bo'yi Telegram'da bo'ladi.

---

## 3. Foydalanuvchi va stsenariylar

### 3.1. Foydalanuvchi profili (Persona)
- **Kim:** Bitta shaxs (loyiha egasi va bir necha yaqin odam). Ko'p
  foydalanuvchili, rollar/ruxsatlar tizimi **kerak emas**.
- **Til:** O'zbek tili (interfeys va AI xabarlari).
- **Vaqt mintaqasi:** Asia/Tashkent (standart), foydalanuvchi o'zgartira oladi.

### 3.2. Asosiy stsenariylar

**S1 — Maqsad qo'shish va bo'lish**
> Foydalanuvchi "3 oyda 5 kg vazn tashlash" maqsadini kiritadi. AI'dan
> "bo'lib ber" so'raydi — Gemini uni haftalik/kunlik kichik vazifalarga
> ajratib beradi.

**S2 — Kundalik ish**
> Foydalanuvchi ertalab ilovani (yoki Telegram xabarini) ochadi va bugungi
> vazifalar ro'yxatini ko'radi. Bajarganini belgilaydi.

**S3 — Kechki avtomatik tahlil**
> Har kuni belgilangan vaqtda (masalan 21:00) tizim avtomatik ravishda
> kunni tahlil qiladi: nima bajarildi, nima qoldi, maqsadlar qanchalik
> oldinga siljidi — va Telegram'ga xulosa + ertangi reja yuboradi.

**S4 — Ertalabki reja**
> Ertalab (masalan 08:00) Telegram'ga bugungi tavsiya etilgan reja keladi:
> kalendardagi band vaqtlar hisobga olinib, bo'sh oraliqlarga vazifalar
> joylashtiriladi, muhimlik tartibida.

**S5 — Talab bo'yicha tahlil**
> Foydalanuvchi istalgan payt ilovadagi "Hozir tahlil qil" tugmasini bosadi
> va darhol yangi tahlil oladi.

**S6 — Kalendar sinxronizatsiyasi**
> Vaqti belgilangan vazifalar Google Calendar'da ham ko'rinadi; Google
> Calendar'dagi uchrashuvlar ilovada band vaqt sifatida hisobga olinadi.

---

## 4. Asosiy modullar

| # | Modul | Tavsif |
|---|-------|--------|
| M1 | **Autentifikatsiya** | Telegram orqali kirish (asosiy). Google akkaunt kalendar uchun ulanadi. |
| M2 | **Maqsadlar** | Maqsad yaratish/tahrirlash/o'chirish, deadline, progress foizi. |
| M3 | **Vazifalar** | Bir martalik va takrorlanuvchi vazifalar; vaqt, sana, prioritet, davomiylik, holat. |
| M4 | **Kalendar** | Ilova ichida kun/hafta/oy ko'rinishi + Google Calendar ikki tomonlama sinxron. |
| M5 | **AI yadrosi (Gemini)** | Kunlik tahlil, ertangi reja, orqada qolganlarni aniqlash, maqsad progressi, motivatsiya, maqsadni bo'lish. |
| M6 | **Telegram bot** | Avtomatik ertalab/kechki xabar yuborish + autentifikatsiya. |
| M7 | **Rejalashtiruvchi (Scheduler)** | Vercel Cron orqali belgilangan vaqtlarda avtomatik tahlil ishga tushiradi. |
| M8 | **Statistika/Hisobot** | Haftalik ko'rsatkichlar, maqsad progressi, tahlil tarixi. |
| M9 | **Sozlamalar** | Tahlil vaqtlari, Telegram/Google ulash, vaqt mintaqasi. |

---

## 5. Ma'lumot modeli (Data Model)

> Baza: **PostgreSQL** (bulutda — Neon yoki Supabase, bepul tarif).

### `users`
| Ustun | Tur | Izoh |
|-------|-----|------|
| id | uuid (PK) | |
| telegram_id | bigint (unique) | Telegram identifikatori |
| telegram_username | text | |
| name | text | |
| google_refresh_token | text (nullable) | Google Calendar uchun |
| timezone | text | standart `Asia/Tashkent` |
| morning_time | time | ertalabki reja vaqti (mas. 08:00) |
| evening_time | time | kechki tahlil vaqti (mas. 21:00) |
| created_at | timestamptz | |

### `goals`
| Ustun | Tur | Izoh |
|-------|-----|------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| title | text | |
| description | text (nullable) | |
| deadline | date (nullable) | ixtiyoriy muddat |
| status | enum(`active`,`completed`,`archived`) | |
| created_at | timestamptz | |

### `tasks`
| Ustun | Tur | Izoh |
|-------|-----|------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| goal_id | uuid (FK, nullable) | vazifa maqsadga bog'lanishi mumkin |
| title | text | |
| description | text (nullable) | |
| type | enum(`one_time`,`recurring`) | |
| date | date (nullable) | bir martalik uchun |
| time | time (nullable) | aniq soat (ixtiyoriy) |
| duration_min | int (nullable) | taxminiy davomiylik |
| priority | enum(`high`,`medium`,`low`) | |
| recurrence_rule | text (nullable) | takrorlanish (mas. kunlar: Mon,Wed) |
| status | enum(`pending`,`done`,`skipped`) | bir martalik uchun joriy holat |
| google_event_id | text (nullable) | Google Calendar bilan bog'lash |
| created_at | timestamptz | |
| completed_at | timestamptz (nullable) | |

### `task_occurrences` (takrorlanuvchi vazifalar tarixi)
| Ustun | Tur | Izoh |
|-------|-----|------|
| id | uuid (PK) | |
| task_id | uuid (FK) | |
| date | date | qaysi kunga tegishli |
| status | enum(`pending`,`done`,`skipped`) | |
| completed_at | timestamptz (nullable) | |

> Takrorlanuvchi vazifaning har kungi bajarilishi shu yerda saqlanadi
> (statistika va AI tahlili uchun zarur).

### `analyses` (AI tahlillari tarixi)
| Ustun | Tur | Izoh |
|-------|-----|------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| type | enum(`morning`,`evening`,`on_demand`) | |
| content | text | to'liq AI matni (o'zbekcha) |
| summary | text (nullable) | qisqa xulosa |
| created_at | timestamptz | |

---

## 6. AI qismi (Google Gemini)

### 6.1. AI funksiyalari
| Kod | Funksiya | Tavsif |
|-----|----------|--------|
| A | **Kunlik yakuniy tahlil** | Bugun nima bajarildi/bajarilmadi — qisqa, motivatsion xulosa. |
| B | **Ertangi reja** | Kalendardagi band vaqtlarni hisobga olib, bo'sh oraliqlarga muhimlik tartibida vazifalar joylashtirish. |
| C | **Orqada qolganlarni aniqlash** | "3 kundan beri sportga bormadingiz" kabi ogohlantirishlar. |
| D | **Maqsad progress bahosi** | Har maqsad bo'yicha % va sur'at bahosi ("sekin/yaxshi"). |
| E | **Motivatsion xabar** | Qisqa psixologik qo'llab-quvvatlash. |
| F | **Maqsadni bo'lish** | Katta maqsadni avtomatik kichik vazifalarga ajratish (foydalanuvchi tasdiqlab qo'shadi). |

### 6.2. Ishlash oqimi (data flow)
1. Scheduler yoki foydalanuvchi tahlilni ishga tushiradi.
2. Tizim kerakli kontekstni yig'adi: bugungi/kechagi vazifalar holati,
   maqsadlar va progressi, Google Calendar band vaqtlari, oxirgi tahlillar.
3. Bu kontekst tuzilgan **prompt** ichida Gemini API'ga yuboriladi
   (o'zbek tilida javob so'raladi).
4. Gemini natijasi **strukturaviy** (JSON) qaytadi: xulosa, ertangi reja
   (vazifa + tavsiya vaqt), ogohlantirishlar, progress bahosi, motivatsiya.
5. Natija `analyses` jadvaliga saqlanadi, ilovada ko'rsatiladi va (avtomatik
   oqimda) Telegram'ga yuboriladi.

### 6.3. Maxfiylik eslatmasi
Vazifa/maqsad matnlari (shaxsiy ma'lumot) Gemini API'ga yuboriladi. Bu
xatarlar bo'limida qayd etiladi; foydalanuvchi bitta shaxs bo'lgani uchun
qabul qilinadi.

---

## 7. Texnik stack

> Stack loyiha egasi tomonidan menga topshirilgan tanlov asosida tanlandi
> (Vercel + Gemini + Google Calendar ekotizimiga mos).

| Qatlam | Texnologiya | Sabab |
|--------|-------------|-------|
| Framework | **Next.js (App Router) + TypeScript** | Frontend + backend (API routes) bitta joyda, Vercel'ga ideal. |
| Hosting | **Vercel** | Serversiz, always-on, Cron mavjud. |
| UI | **React + Tailwind CSS + shadcn/ui** | Tez va sifatli interfeys. |
| Baza | **PostgreSQL (Neon)** | Serversizga mos, bepul tarif yetarli. |
| ORM | **Drizzle ORM** | Serversiz muhitda yengil va tez. |
| Auth | **Auth.js (NextAuth)** — Telegram Login + Google OAuth | Telegram bilan kirish, Google kalendar uchun. |
| AI | **Google Gemini API** (`@google/generative-ai`) | Topshirilgan model. |
| Telegram | **grammY** (webhook rejimi) | Serversiz/webhook'ga mos zamonaviy kutubxona. |
| Kalendar | **googleapis** | Google Calendar sinxron. |
| Scheduler | **Vercel Cron Jobs** | Ertalab/kechki avtomatik tahlil. |

---

## 8. Cheklovlar — nima KIRMAYDI (Out of Scope)

Ushbu versiyada quyidagilar **yo'q**:
- ❌ Ko'p foydalanuvchili tizim, jamoalar, rollar/ruxsatlar.
- ❌ Alohida mobil ilova (Android/iOS) — faqat veb + Telegram.
- ❌ Uch bosqichli tuzilma (Maqsad → Milestone → Vazifa). Faqat 2 bosqich.
- ❌ Har bir vazifa uchun alohida vaqtli eslatma (masalan "10 daqiqadan keyin").
  Faqat kunlik ertalab/kechki xabar.
- ❌ Telegram orqali interaktiv buyruqlar ("bajardim", "qoldir" chatda).
  Telegram asosan chiquvchi xabar + autentifikatsiya.
- ❌ Google Calendar'dan boshqa kalendarlar (Apple, Outlook).
- ❌ Offline/lokal AI modeli — faqat bulutli Gemini.
- ❌ To'lov, obuna, monetizatsiya.

---

## 9. Xatarlar (Risks)

| # | Xatar | Ta'sir | Yumshatish |
|---|-------|--------|------------|
| R1 | Gemini API kvota/xarajat cheklovi | Tahlil ishlamay qolishi | Bepul tarif ichida qolish, kunlik chaqiruvlar sonini cheklash. |
| R2 | Google Calendar OAuth murakkabligi va token muddati | Kalendar sinxron uzilishi | Refresh token saqlash, xatolikda qayta ulash so'rovi. |
| R3 | Vercel serversiz vaqt cheklovi (funksiya timeout) | Uzoq AI tahlili uzilishi | Tahlilni yengil, strukturaviy promptlar bilan tez qilish. |
| R4 | Shaxsiy ma'lumot Gemini'ga yuborilishi | Maxfiylik | Bitta shaxs uchun qabul qilinadi; kelajakda anonimlashtirish mumkin. |
| R5 | Vaqt mintaqasi/ DST xatolari (reja vaqtlari) | Xabar noto'g'ri vaqtda | Barcha vaqtni UTC saqlab, foydalanuvchi TZ bo'yicha konvertatsiya. |
| R6 | Telegram Login Widget domen talablari | Kirish ishlamasligi | Bot domenini Vercel domeniga to'g'ri sozlash. |
| R7 | Takrorlanuvchi vazifa occurrence'larini yaratish murakkabligi | Statistika noaniqligi | Aniq `task_occurrences` modeli va kunlik generatsiya logikasi. |

---

## 10. Sprintlar (4 ta ketma-ket bosqich)

> Har bir sprint oldingisiga asoslanadi. Tartib majburiy.

### 🏗️ Sprint 1 — Poydevor va CRUD

**Maqsad:** Loyiha skeleti, ma'lumot bazasi va maqsad/vazifa boshqaruvining
asosiy ishlaydigan versiyasi + Telegram bilan kirish.

**Ish qamrovi:**
- Next.js + TypeScript loyiha, Vercel'ga deploy.
- Neon Postgres + Drizzle sxema (`users`, `goals`, `tasks`, `task_occurrences`).
- Telegram Login orqali autentifikatsiya (Auth.js).
- Ekranlar: bugungi vazifalar, maqsadlar ro'yxati, qo'shish/tahrirlash/o'chirish.
- Bir martalik va takrorlanuvchi vazifa yaratish, holatni belgilash.

**Deliverable:** Vercel'da ishlaydigan veb-ilova; Telegram bilan kiriladi;
maqsad va vazifalar yaratiladi, tahrirlanadi, o'chiriladi; bugungi vazifalar
ekranda ko'rinadi.

**Tayyorlik mezoni (DoD):**
- [ ] Foydalanuvchi Telegram orqali kirib, o'z profilini oladi.
- [ ] Maqsad qo'sha oladi (deadline ixtiyoriy).
- [ ] Bir martalik va takrorlanuvchi vazifa qo'sha oladi (vaqt, prioritet, davomiylik bilan).
- [ ] Vazifani "bajarildi" deb belgilay oladi.
- [ ] Barcha ma'lumot bazada saqlanadi va qayta yuklashda saqlanib qoladi.

---

### 📅 Sprint 2 — Kalendar va Google integratsiya

**Maqsad:** Ilova ichida kalendar ko'rinishi va Google Calendar bilan ikki
tomonlama sinxronizatsiya.

**Ish qamrovi:**
- Google OAuth ulash (refresh token saqlash).
- Kalendar ko'rinishi: kun / hafta / oy.
- Vaqti bor vazifalarni Google Calendar'ga yozish (`google_event_id`).
- Google Calendar'dagi band vaqtlarni ilovaga tortib olish (o'qish).
- Sozlamalarda Google ulash/uzish.

**Deliverable:** Foydalanuvchi Google akkauntini ulaydi; vazifalar Google
Calendar'da ko'rinadi; tashqi uchrashuvlar ilovada band vaqt sifatida
ko'rsatiladi; ilovada kalendar ko'rinishi ishlaydi.

**Tayyorlik mezoni (DoD):**
- [ ] Google akkaunt muvaffaqiyatli ulanadi va token saqlanadi.
- [ ] Vaqti belgilangan vazifa Google Calendar'da paydo bo'ladi.
- [ ] Google Calendar'dagi bandliklar ilovaning kalendar ko'rinishida ko'rinadi.
- [ ] Kun/hafta/oy ko'rinishlari almashtiriladi.

---

### 🤖 Sprint 3 — AI yadrosi (Gemini)

**Maqsad:** Gemini bilan barcha AI funksiyalarini (A–F) ishga tushirish —
hozircha talab bo'yicha (qo'lda ishga tushiriladigan) rejimda.

**Ish qamrovi:**
- Gemini API integratsiyasi, strukturaviy (JSON) javob.
- Kontekst yig'uvchi qatlam (vazifalar, maqsadlar, kalendar band vaqtlari).
- Funksiyalar: kunlik tahlil, ertangi reja (band vaqtlarni hisobga olib),
  orqada qolganlarni aniqlash, maqsad progressi, motivatsiya, maqsadni bo'lish.
- Ilovada "Hozir tahlil qil" tugmasi.
- Tahlillar tarixi ekrani (`analyses`).

**Deliverable:** Foydalanuvchi tugma bosganda Gemini to'liq tahlil beradi va
natija ilovada ko'rsatilib, tarixga saqlanadi.

**Tayyorlik mezoni (DoD):**
- [ ] "Tahlil qil" bosilganda Gemini bugungi holatni tahlil qiladi.
- [ ] Ertangi reja tavsiya qilinadi (kalendar band vaqtlari hisobga olinadi).
- [ ] Orqada qolgan vazifalar aniqlanadi va ko'rsatiladi.
- [ ] Har maqsad bo'yicha progress % va baho beriladi.
- [ ] Motivatsion xabar chiqadi.
- [ ] Katta maqsad kichik vazifalarga bo'lib beriladi (foydalanuvchi tasdiqlab qo'shadi).
- [ ] Tahlillar tarix ekranida saqlanadi.

---

### ⏰ Sprint 4 — Avtomatlashtirish, Telegram eslatma va statistika

**Maqsad:** Kunlik oqimni to'liq avtomatlashtirish (Cron) + Telegram xabarlari
+ statistika va sozlamalar bilan mahsulotni yakunlash.

**Ish qamrovi:**
- Vercel Cron: ertalab (reja) va kechqurun (yakuniy tahlil) avtomatik ishga tushirish.
- Har foydalanuvchining `morning_time` / `evening_time` va TZ bo'yicha vaqtni hisoblash.
- Gemini natijasini Telegram'ga yuborish (grammY, webhook).
- Statistika/hisobot ekrani (haftalik: bajarilgan vazifalar, maqsad progressi).
- Sozlamalar: tahlil vaqtlari, vaqt mintaqasi, integratsiyalarni boshqarish.

**Deliverable:** Belgilangan vaqtda tizim avtomatik tahlil qilib Telegram'ga
ertalabki reja va kechki xulosani yuboradi; foydalanuvchi vaqt va
integratsiyalarni sozlamalardan boshqaradi; haftalik statistika ishlaydi.

**Tayyorlik mezoni (DoD):**
- [ ] Cron belgilangan vaqtda avtomatik ishga tushadi.
- [ ] Ertalab Telegram'ga bugungi reja keladi.
- [ ] Kechqurun Telegram'ga yakuniy tahlil + ertangi reja keladi.
- [ ] Foydalanuvchi tahlil vaqtlarini va TZ'ni sozlamalardan o'zgartira oladi.
- [ ] Haftalik statistika ekrani to'g'ri ko'rsatkichlar beradi.
- [ ] Google/Telegram ulash-uzish sozlamalardan boshqariladi.

---

## Ilova: Aniqlashtirilgan qarorlar xulosasi

| Nuqta | Qaror |
|-------|-------|
| Foydalanuvchi | Shaxsiy vosita (bitta shaxs) |
| Tuzilma | Maqsad → Vazifa (2 bosqich) |
| Vazifa turi | Bir martalik + takrorlanuvchi, barcha atributlar |
| AI funksiyalari | A–F (tahlil, reja, orqada qolgan, progress, motivatsiya, bo'lish) |
| AI vaqti | Ertalab + kechqurun + talab bo'yicha |
| AI kanali | Telegram + ilova ichida |
| Kalendar | Google Calendar sinxron, band vaqtlar hisobga olinadi |
| Ilova turi | Veb-ilova + Telegram bot (mobil yo'q) |
| AI modeli | Google Gemini API |
| Til | O'zbek tili |
| Hosting/Baza | Vercel + Neon Postgres |
| Autentifikatsiya | Telegram (kirish) + Google (kalendar) |
| Eslatmalar | Faqat kunlik (ertalab + kechqurun) |
