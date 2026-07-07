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
- [ ] Telegram Mini App moslash (WebApp SDK, initData auth).
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
- [ ] Ilova Telegram Mini App sifatida ochiladi va asosiy ekranlar ishlaydi.
- [ ] Unit/integratsion/E2E testlar yozilgan va o'tadi.
- [ ] Uchdan-oxirgacha (login → vazifa → tahlil → Telegram) real muhitда ishlaydi.
- [ ] Ma'lum kritik buglar tuzatilgan, mahsulot production'ga tayyor.

---

## 9. Loyihaning yakuniy holati (4 sprintdan so'ng)

Telegram bilan kiriladigan, maqsad va vazifalarni boshqaradigan, Google
Calendar bilan sinxronlanadigan, har kuni Gemini orqali avtomatik tahlil qilib
Telegram'ga reja/xulosa yuboradigan, veb va Telegram Mini App sifatida
ishlaydigan shaxsiy AI yordamchi — to'liq ishlaydigan holatda.
