# Sprint 1 — Dizayn va Ekranlar

> **Bosqich:** 1/4
> **Fokus:** UI/UX dizayn, dizayn tizimi va barcha ekranlarni (mock ma'lumot bilan) yaratish.
> **Backend YO'Q** — bu bosqichda faqat vizual qism va navigatsiya.

---

## 1. Maqsad

Butun ilovaning ko'rinishini (frontend) tayyor holatga keltirish: dizayn
tizimi, barcha ekranlar, komponentlar va sahifalararo o'tish (navigatsiya) —
haqiqiy ma'lumot o'rniga **mock (soxta) ma'lumot** bilan. Yakunda "bosib
ko'rish mumkin bo'lgan prototip" bo'ladi.

---

## 2. Nima uchun birinchi?

Ekranlar aniq bo'lgach, keyingi sprintlarda backend va API'lar aynan shu
ekranlar talabiga mos quriladi. Bu qayta ishlashni kamaytiradi.

---

## 3. Dizayn tizimi (Design System)

- **Texnologiya:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui.
- **Til:** Barcha matnlar o'zbek tilida (kelajakda i18n uchun matnlar ajratilgan holda).
- **Rang palitrasi:** asosiy rang, ikkilamchi, muvaffaqiyat (yashil), ogohlantirish (sariq), xato (qizil), neytral kulranglar. Light/Dark rejim.
- **Tipografika:** sarlavha / matn / kichik matn o'lchamlari.
- **Komponentlar kutubxonasi:** tugma, input, select, modal, card, badge (prioritet/holat), checkbox, tab, toast, avatar, progress bar.
- **Ikonalar:** `lucide-react`.
- **Responsivlik:** mobil va desktop (mobil-birinchi yondashuv, chunki keyin Telegram Mini App ham bo'ladi).

---

## 4. Ekranlar ro'yxati

| # | Ekran | Tarkib |
|---|-------|--------|
| E1 | **Kirish (Login)** | Telegram bilan kirish tugmasi, logotip, qisqa tavsif. |
| E2 | **Bugungi vazifalar (Home)** | Bugungi sana, vazifalar ro'yxati (checkbox, prioritet badge, vaqt, davomiylik), "vazifa qo'shish" tugmasi. |
| E3 | **Maqsadlar ro'yxati** | Maqsad kartalari: sarlavha, deadline, progress bar (%), holat. |
| E4 | **Maqsad tafsiloti** | Maqsad ma'lumoti + unga tegishli vazifalar ro'yxati + progress + "AI bilan bo'lish" tugmasi. |
| E5 | **Kalendar** | Kun / hafta / oy ko'rinishlari; vazifalar va band vaqtlar bloklari. |
| E6 | **AI tahlili** | Joriy tahlil: xulosa, ertangi reja, ogohlantirishlar, motivatsiya; "Hozir tahlil qil" tugmasi. |
| E7 | **Tahlil tarixi** | O'tgan tahlillar ro'yxati (sana bo'yicha), bosilганda to'liq matn. |
| E8 | **Statistika** | Haftalik ko'rsatkichlar: bajarilgan vazifalar soni, maqsadlar progressi, grafik. |
| E9 | **Sozlamalar** | Tahlil vaqtlari (ertalab/kechqurun), vaqt mintaqasi, Telegram/Google ulash holati, chiqish. |
| M1 | **Vazifa qo'shish/tahrirlash (modal)** | Sarlavha, tavsif, tur (bir martalik/takrorlanuvchi), sana, vaqt, davomiylik, prioritet, maqsadga bog'lash. |
| M2 | **Maqsad qo'shish/tahrirlash (modal)** | Sarlavha, tavsif, deadline (ixtiyoriy). |

---

## 5. Navigatsiya

- Asosiy tuzilma: pastki (mobil) yoki yon (desktop) menyu — Home, Maqsadlar, Kalendar, AI, Statistika, Sozlamalar.
- Modal oynalar orqali qo'shish/tahrirlash.
- Login qilinmagan holatda faqat E1 ko'rinadi.

---

## 6. Vazifalar (Tasklar)

- [x] Next.js + Tailwind + shadcn/ui loyihasini sozlash. **Deviatsiya:** Tailwind + shadcn/ui o'rniga CSS Modules + dizayn tokenlar (`tokens.css`) yondashuvi qo'llanildi — Telegram Mini App va aniq rang/o'lcham nazorati uchun maqsadga muvofiq deb topildi.
- [x] Dizayn tizimini yaratish (ranglar, tipografika, light/dark). Dizayn tokenlar `src/app/(app)/tokens.css`da; dark-birinchi yondashuv.
- [x] Umumiy layout va navigatsiya (menyu) komponenti. `src/app/(app)/layout.tsx` + `nav.tsx` — mobil pastki tab-bar / desktop yon sidebar.
- [x] 9 ta ekran + 2 ta modalni mock ma'lumot bilan yaratish. Barcha asosiy ekranlar (goals, tasks, xarajat, tahlil, sozlamalar, ai) yaratildi; M1/M2 modallari sahifalar ichiga inline sheet sifatida kiritildi.
- [x] Responsiv holatni tekshirish (mobil + desktop). Mobil va desktop ko'rinishlari tekshirilgan.
- [ ] Bo'sh holatlar (empty state) va yuklanish (loading skeleton) ko'rinishlari.
- [x] Vercel'ga dastlabki deploy (statik/mock holatда). Loyiha Vercel'da muvaffaqiyatli deploy bo'lgan (commit ae02fd5).

---

## 7. Deliverable (Aniq natija)

Vercel'da ochiladigan, barcha ekranlari va navigatsiyasi ishlaydigan
**frontend prototip** — mock ma'lumot bilan to'ldirilgan, mobil va desktop'da
to'g'ri ko'rinadigan.

---

## 8. Tayyorlik mezoni (Definition of Done)

- [x] Barcha 9 ekran + 2 modal yaratilgan va navigatsiya orqali ochiladi.
- [x] Dizayn tizimi (ranglar, komponentlar, light/dark) qo'llanilgan.
- [x] Barcha matnlar o'zbek tilida.
- [x] Mobil va desktop ko'rinishlari buzilmaydi (responsiv).
- [ ] Empty state va loading skeleton ko'rinishlari mavjud.
- [x] Loyiha Vercel'da muvaffaqiyatli deploy bo'lgan.
- [x] Kod strukturasi keyingi sprintda backend ulashga tayyor (komponentlar mock ma'lumotdan ajratilgan).

---

## 9. Ushbu sprintga KIRMAYDI

- ❌ Ma'lumotlar bazasi, API, haqiqiy CRUD.
- ❌ Haqiqiy autentifikatsiya (faqat login tugmasi ko'rinishi).
- ❌ AI, Gemini, kalendar sinxron, Telegram.

---

## Hisobot

- **2026-07-16** — Dizayn tizimi va barcha asosiy ekranlar yaratildi (commit ae02fd5). CSS Modules + dizayn tokenlar (`src/app/(app)/tokens.css`) yondashuvi qo'llanildi (Tailwind/shadcn o'rniga). UI komponentlar kutubxonasi (`src/components/ui/`: Button, Card, Input, ProgressBar, Segmented, Sheet, StatusTag, icons) yaratildi. Responsiv app shell (`layout.tsx`, `nav.tsx` — mobil pastki tab-bar / desktop yon sidebar) qurildi. Barcha asosiy sahifalar (goals, tasks, xarajat, tahlil, sozlamalar, ai) va modal (sheet) komponentlari tayyor; Sprint 1 dizaynidagi barcha ekranlar haqiqiy backend bilan birga ishga tushirildi (Sprint 2 va Sprint 3 ishlari bilan parallel). Empty state va loading skeleton ko'rinishlari hali to'liq qilinmagan.
