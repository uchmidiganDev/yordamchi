# Sprint 4 — Testlash, Telegram Bot Integratsiya va Mini Web App

> **Bosqich:** 4/4 (yakuniy)
> **Fokus:** Avtomatlashtirish + Telegram bot orqali xabar, Telegram Mini App va sifat (testlash).
> **Asos:** Sprint 3'dagi AI va kalendar ustiga avtomatik oqim va Telegram qatlami quriladi.

---

## 1. Maqsad

Kunlik oqimni to'liq avtomatlashtirish (belgilangan vaqtda AI tahlili +
Telegram xabari), ilovani Telegram Mini App sifatida ochish imkonini berish
va butun tizimni testlab, barqaror mahsulotга aylantirish.

---

## 2. Avtomatlashtirish (Scheduler)

- **Vosita:** Vercel Cron Jobs.
- **Ertalabki oqim:** har foydalanuvchining `morning_time` (va TZ) bo'yicha — bugungi reja tuziladi va Telegram'ga yuboriladi.
- **Kechki oqim:** `evening_time` bo'yicha — kunlik yakuniy tahlil + ertangi reja Telegram'ga yuboriladi.
- Cron UTC'da ishlaydi; foydalanuvchi vaqt mintaqasi bo'yicha kimga xabar yuborish kerakligi hisoblanadi.
- Xatolik holatida qayta urinish / log.

---

## 3. Telegram bot integratsiyasi

- **Kutubxona:** grammY (webhook rejimi, Vercel'ga mos).
- **Chiquvchi xabarlar:** ertalabki reja va kechki tahlil formatланган (o'qish uchun qulay) matn sifatida yuboriladi.
- **Autentifikatsiya bog'lash:** foydalanuvchi Telegram akkauntini ilova bilan bog'lashini yakuniy holatga keltirish (Sprint 2 login'i bilan integratsiya).
- **Webhook** Vercel domeni bilan to'g'ri sozlanadi.

> Eslatma: Telegram asosan **chiquvchi** xabar + autentifikatsiya uchun. Interaktiv chat buyruqlari (bajardim/qoldir) qamrovga kirmaydi.

---

## 4. Telegram Mini Web App

- Ilovani (mavjud veb-frontend asosida) Telegram ichida ochiladigan **Mini App** sifatida moslash.
- Telegram WebApp SDK orqali foydalanuvchini aniqlash (Telegram initData) — qo'shimcha login'siz kirish.
- Mobil-birinchi dizayn (Sprint 1'da tayyorlangani) Mini App uchun mos keladi.
- Asosiy ekranlar (bugungi vazifalar, kalendar, AI tahlili) Telegram ichida ishlaydi.

**Holat: bajarildi (2026-07-23, commit `4cf10c5`).** Amalga oshirilgan qism:
- Root layout'ga (`src/app/layout.tsx`) Telegram WebApp SDK skripti (`telegram-web-app.js`) va `viewport-fit=cover` qo'shildi.
- Yangi `src/components/telegram-mini-app.tsx` (client) — `WebApp.ready()`/`expand()`, header/fon rangini moslashtirish, `disableVerticalSwipes()`, `BackButton`'ni ichki navigatsiyaga bog'lash.
- Yangi `src/lib/telegram-webapp-auth.ts` — Telegram `initData`ning HMAC-SHA256 imzosini rasmiy algoritm bo'yicha tekshiradi.
- Yangi `POST /api/auth/telegram/webapp` — `initData` tekshirilib, `ALLOWED_TELEGRAM_ID`ga mos kelsa sessiya cookie'si o'rnatiladi (mavjud `/start` deeplink login o'zgarmadi, bu qo'shimcha yo'l).
- `src/proxy.ts`dagi `PUBLIC_PATHS`ga yangi endpoint qo'shildi; `src/lib/telegram-api.ts`ga `setChatMenuButton()` qo'shildi.
- `scripts/set-mini-app-menu-button.ts` — bot chatining doimiy menyu tugmasini mini-app'ga ulaydigan bir martalik skript (hali ishga tushirilmagan).
- `src/lib/telegram-bot.ts`ga yangi `/app` buyrug'i (inline web_app tugmasi bilan mini-app'ni ochadi).
- Build/lint/tsc tekshiruvidan o'tgan va `initData` HMAC tekshiruvi haqiqiy imzo bilan jonli sinovda (dev server) tasdiqlangan. Cron/scheduler, ertalabki-kechki avtomatik xabar va unit/integratsion/E2E testlar hali bajarilmagan (quyidagi vazifalar ro'yxatiga qarang).

---

## 5. Testlash va sifat

- **Unit testlar:** kritik mantiq (occurrence generatsiyasi, TZ hisoblash, AI kontekst yig'ish, sinxron logikasi).
- **Integratsion testlar:** CRUD, auth oqimi, Gemini chaqiruvi (mock bilan), Cron endpoint.
- **E2E (asosiy oqim):** login → vazifa qo'shish → tahlil → Telegram xabari (test muhitida).
- **Qo'lda test:** haqiqiy Telegram va Google Calendar bilan uchdan-oxirgacha tekshirish.
- Xatolarni tuzatish (bug-fix), chekka holatlar (edge case), yuklanish/xato holatlari.
- Yakuniy productionга tayyorlash: muhit o'zgaruvchilari, xavfsizlik, loglar.

---

## 6. Vazifalar (Tasklar)

- [ ] Vercel Cron sozlash (ertalab/kechqurun endpointlar).
- [ ] Foydalanuvchi TZ bo'yicha kimga qachon xabar yuborishni hisoblash.
- [ ] grammY bot + webhook Vercel'da.
- [ ] Ertalabki reja / kechki tahlilni Telegram'ga formatlab yuborish.
- [ ] Telegram akkaunt bog'lashni yakunlash.
- [x] Telegram Mini App moslash (WebApp SDK, initData auth).
- [ ] Unit + integratsion + E2E testlar.
- [ ] Qo'lda uchdan-oxirgacha test (Telegram + Google real).
- [ ] Bug-fix va productionга tayyorlash.

---

## 7. Deliverable (Aniq natija)

Belgilangan vaqtda avtomatik AI tahlili qilib Telegram'ga ertalabki reja va
kechki xulosa yuboradigan, Telegram ichida Mini App sifatida ochiladigan va
testlardan o'tgan barqaror mahsulot.

---

## 8. Tayyorlik mezoni (Definition of Done)

- [ ] Cron belgilangan vaqtда (TZ bo'yicha) avtomatik ishlaydi.
- [ ] Ertalab Telegram'ga bugungi reja keladi.
- [ ] Kechqurun Telegram'ga yakuniy tahlil + ertangi reja keladi.
- [ ] Telegram akkaunt ilova bilan to'g'ri bog'lanadi.
- [x] Ilova Telegram Mini App sifatida ochiladi va asosiy ekranlar ishlaydi.
- [ ] Unit/integratsion/E2E testlar yozilgan va o'tadi.
- [ ] Uchdan-oxirgacha (login → vazifa → tahlil → Telegram) real muhitда ishlaydi.
- [ ] Ma'lum kritik buglar tuzatilgan, mahsulot production'ga tayyor.

---

## 9. Loyihaning yakuniy holati (4 sprintdan so'ng)

Telegram bilan kiriladigan, maqsad va vazifalarni boshqaradigan, Google
Calendar bilan sinxronlanadigan, har kuni Gemini orqali avtomatik tahlil qilib
Telegram'ga reja/xulosa yuboradigan, veb va Telegram Mini App sifatida
ishlaydigan shaxsiy AI yordamchi — to'liq ishlaydigan holatda.

---

## Hisobot

- **2026-07-23** — Telegram Mini App funksiyasi amalga oshirildi va push qilindi (commit `4cf10c5`): Telegram WebApp SDK ulash (root layout + `telegram-mini-app.tsx`), `initData`ning HMAC-SHA256 imzosini tekshiruvchi `src/lib/telegram-webapp-auth.ts` va `POST /api/auth/telegram/webapp` orqali qo'shimcha avtomatik kirish yo'li, bot menyusiga mini-app tugmasi (`setChatMenuButton`, `scripts/set-mini-app-menu-button.ts`) va `/app` buyrug'i. Build/lint/tsc o'tdi, `initData` tekshiruvi jonli (dev server) sinovda tasdiqlandi. Shu sabab 6-bo'limdagi "Telegram Mini App moslash (WebApp SDK, initData auth)" va 8-bo'limdagi "Ilova Telegram Mini App sifatida ochiladi va asosiy ekranlar ishlaydi" bandlari `[x]` deb belgilandi. Sprintning qolgan qismi (Vercel Cron/scheduler, ertalabki-kechki avtomatik Telegram xabari, Telegram akkaunt bog'lashni yakunlash, unit/integratsion/E2E testlar, production'ga tayyorlash) hali bajarilmagan.
