# CLAUDE.md — Loyiha qarorlari jurnali

> Bu fayl loyiha davomida qabul qilingan texnik/mahsulot qarorlarini va
> avtomatlashtirish qoidalarini qayd etib boradi. Har bir yangi qaror shu
> yerga yoziladi — takrorlanmasin va kelajakdagi agentlar/ishtirokchilar
> kontekstni tez tiklay olsin.

## Qabul qilingan qarorlar

- **2026-07-14** — Auth.js (NextAuth) + Telegram Login Widget o'rniga Telegram bot deeplink (`/start` orqali) + custom JWT sessiya (`jose` kutubxonasi, httpOnly cookie) yondashuvi qo'llanildi. Sabab: foydalanuvchi faqat o'zining Telegram ID'si (8172404961) orqali kirishni talab qildi; bu tekshiruvni bot `/start` handlerida to'g'ridan-to'g'ri amalga oshirish Auth.js provayder sxemasidan ko'ra soddaroq va talabga aniqroq mos keladi.
- **2026-07-14** — Sprint 1 (Dizayn va Ekranlar) alohida joyda tayyorlanib, keyinroq loyihaga qo'shiladi deb kelishildi. Shu sababli DB/backend/avtorizatsiya ishi loyihada birinchi bajarilgan ish bo'lsa-da, hujjatlashtirilgan tartibda "Sprint 2" (`sprints/2-sprint-db-bekend-avtorizatsiya-crud.md`) rejasi doirasida bajarildi deb hisoblanadi.
