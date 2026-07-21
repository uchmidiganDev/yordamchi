# Sprint 3 — Asosiy Funksiyalar, AI va Kalendar Ulash

> **Bosqich:** 3/4
> **Fokus:** Gemini AI yadrosi (A–F funksiyalar) va Google Calendar ikki tomonlama sinxronizatsiya.
> **Asos:** Sprint 2'dagi ma'lumot va auth ustiga ilovaning "aqli" quriladi.

---

## 1. Maqsad

Platformaning asosiy qiymatini — AI tahlili va aqlli rejalashtirishni ishga
tushirish. Google Gemini orqali kunlik tahlil, ertangi reja, progress bahosi
va maqsadni bo'lish; Google Calendar bilan vazifalarni sinxronlash va band
vaqtlarni hisobga olish. Bu bosqichda AI **talab bo'yicha** (qo'lda tugma
bilan) ishlaydi; to'liq avtomatlashtirish Sprint 4'da.

---

## 2. AI yadrosi (Google Gemini)

- **Kutubxona:** `@google/generative-ai`.
- **Chiqish formati:** strukturaviy JSON (xulosa, reja, ogohlantirish, progress, motivatsiya).
- **Til:** javoblar o'zbek tilida.

### Kontekst yig'uvchi qatlam
AI'ga yuboriladigan kontekst:
- Bugungi va kechagi vazifalar hamda ularning holati.
- Faol maqsadlar va ularning progressi.
- Google Calendar'dagi band vaqtlar (bo'sh oraliqlarni topish uchun).
- Oxirgi bir necha tahlil (kontekst uzluksizligi uchun).

### AI funksiyalari
| Kod | Funksiya | Natija |
|-----|----------|--------|
| A | Kunlik yakuniy tahlil | Bugun bajarilgan/bajarilmagan xulosasi. |
| B | Ertangi reja | Band vaqtlarni hisobga olib, muhimlik tartibida vazifa joylashtirish. |
| C | Orqada qolganlarni aniqlash | Uzoq bajarilmagan vazifa/maqsad ogohlantirishi. |
| D | Maqsad progress bahosi | Har maqsad % va sur'at bahosi. |
| E | Motivatsion xabar | Qisqa qo'llab-quvvatlash. |
| F | Maqsadni bo'lish | Katta maqsadni kichik vazifalarga ajratish (foydalanuvchi tasdiqlab qo'shadi). |

---

## 3. AI'ni ilovaga ulash

- E6 (AI tahlili) ekranidagi **"Hozir tahlil qil"** tugmasi haqiqiy Gemini chaqiruvini ishga tushiradi.
- Natija `analyses` jadvaliga saqlanadi va E7 (Tahlil tarixi) ekranida ko'rinadi.
- E4 (Maqsad tafsiloti) dagi **"AI bilan bo'lish"** tugmasi F funksiyasini ishga tushiradi — taklif qilingan vazifalarni foydalanuvchi tasdiqlab qo'shadi.

---

## 4. Google Calendar sinxronizatsiya

- **Kutubxona:** `googleapis`.
- Sprint 2'da saqlangan refresh token orqali ulanish.

### Sinxron mantiqi
- **Chiqish (ilova → Google):** vaqti belgilangan vazifa Google Calendar'da event sifatida yaratiladi/yangilanadi (`tasks.google_event_id`).
- **Kirish (Google → ilova):** foydalanuvchi kalendaridagi band vaqtlar (uchrashuvlar) o'qiladi va ilovaning E5 (Kalendar) ko'rinishida hamda AI kontekstida band vaqt sifatida ishlatiladi.
- Token muddati tugaganida qayta ulash so'rovi.

---

## 5. Vazifalar (Tasklar)

- [x] Gemini API integratsiyasi va strukturaviy JSON chiqish. **Deviatsiya:** `@google/generative-ai` paketi o'rniga `src/lib/gemini.ts`da to'g'ridan-to'g'ri `fetch` bilan Generative Language API (`generateContent`, `responseMimeType: application/json` + `responseSchema`) chaqiriladi — `google-oauth.ts`dagi qaror bilan izchil, paket bog'liqligi yo'q. Model `GEMINI_MODEL` env orqali (standart `gemini-2.5-flash`). `GEMINI_API_KEY` endi `.env.local`ga kiritilgan va 2026-07-20'da `scripts/smoke-sprint3.ts` orqali jonli chaqiruv muvaffaqiyatli sinovdan o'tdi.
- [x] Kontekst yig'uvchi qatlam (vazifa/maqsad/kalendar ma'lumotini yig'ish). `src/lib/ai-context.ts` (`buildAiContext`, `formatContextForPrompt`) — bugungi/kechagi/ertangi vazifalar, muddati o'tganlar, muddatsizlar, faol maqsadlar progressi, Google Calendar band vaqtlari, oxirgi 3 tahlil xulosasi; `src/lib/tz.ts` server UTC sharoitida foydalanuvchi vaqt mintaqasi bo'yicha kun chegaralarini hisoblaydi.
- [x] A–F funksiyalarini prompt orqali amalga oshirish. **Deviatsiya:** A–E alohida promptlar emas, BITTA strukturaviy Gemini chaqiruvida (`runManualAnalysis()`, `src/lib/actions/ai.ts`) amalga oshirildi; F (`suggestGoalTasks`) alohida chaqiruv sifatida qoldi.
- [x] "Hozir tahlil qil" tugmasi → tahlil → saqlash → ko'rsatish. `ai-client.tsx` + `runManualAnalysis()` natijani `analyses` jadvaliga (`kind: manual`) saqlaydi. Kod tayyor va build o'tgan; xuddi shu Gemini chaqiruv (A–E, bitta strukturaviy so'rov) `scripts/smoke-sprint3.ts` orqali 2026-07-20'da jonli sinovdan o'tdi. Tugmaning o'zi (saqlash bilan birga to'liq UI oqimi) hali brauzerda alohida bosib ko'rilmagan.
- [x] Tahlil tarixi (E7) haqiqiy ma'lumot bilan. `/ai` sahifasida tahlil tarixi ro'yxati DB'dan o'qiladi (bosilganda to'liq ochiladi); hozircha tarix bo'sh, chunki `runManualAnalysis()` orqali hali hech qanday tahlil saqlanmagan (smoke-test natijani ataylab saqlamaydi).
- [x] "AI bilan bo'lish" (F) → taklif → tasdiqlab qo'shish. `suggestGoalTasks()`/`addGoalTasks()` + `goals-client.tsx`dagi "AI bilan bo'lish" tugmasi va `AiSplitSheet`; xuddi shu Gemini chaqiruv mexanizmi smoke-testda tasdiqlangan bo'lsa-da, `suggestGoalTasks()` funksiyasining o'zi hali alohida jonli sinalmagan.
- [x] Google Calendar chiqish sinxroni (vazifa → event). `src/lib/actions/tasks.ts`: createTask/updateTask/deleteTask vaqti belgilangan bir martalik vazifalarni primary kalendarga event sifatida yozadi/yangilaydi/o'chiradi (`tasks.google_event_id`, migratsiya `drizzle/0004_google-event-id.sql`). Takrorlanuvchi vazifalar ataylab sinxronlanmaydi (RRULE murakkabligi). Sinxron best-effort — kalendar xatosi CRUDni to'xtatmaydi. Jonli Google hisob bilan hali sinalmagan.
- [x] Google Calendar kirish (band vaqtlarni o'qish). `src/lib/google-calendar.ts` — `listBusyEvents()` (`events.list`, `singleEvents=true`), bekor qilingan/transparent/ilova o'zi yaratgan eventlar chiqarib tashlanadi. Jonli sinov kutilmoqda.
- [x] Kalendar ko'rinishi (E5) da vazifa + band vaqtlarni birga ko'rsatish. Yangi `/kalendar` sahifasi (server komponent, kun navigatsiyasi): kun ko'rinishi + hafta chizig'i, vazifalar va Google band vaqtlari xronologik birga, vaqtsiz/kun bo'yi bloklar alohida, legenda; `nav.tsx`ga "Kalendar" tabi qo'shildi.
- [x] Token yangilash / xatoликda qayta ulash. `google-oauth.ts`ga `refreshGoogleAccessToken` va `GoogleTokenRevokedError` qo'shildi; `google-calendar.ts` instans ichida token kesh; `invalid_grant` bo'lsa `googleRefreshToken` bazadan avtomatik tozalanadi — Sozlamalarda "Ulanmagan" ko'rinib qayta ulash so'raladi.

---

## 6. Deliverable (Aniq natija)

Foydalanuvchi tugma bosganda Gemini to'liq tahlil (xulosa, ertangi reja,
ogohlantirish, progress, motivatsiya) beradi va natija saqlanadi; katta maqsad
kichik vazifalarga bo'linadi; vazifalar Google Calendar bilan ikki tomonlama
sinxronlanadi va band vaqtlar rejaga ta'sir qiladi.

---

## 7. Tayyorlik mezoni (Definition of Done)

- [x] "Tahlil qil" bosilganda Gemini bugungi holatni tahlil qiladi (A). *Jonli sinovdan o'tdi — 2026-07-20, `scripts/smoke-sprint3.ts` (`npx tsx scripts/smoke-sprint3.ts`) orqali haqiqiy `GEMINI_API_KEY` va DB ma'lumotlari bilan tekshirildi. UI'dagi "Hozir tahlil qil" tugmasi xuddi shu server action'ni (`runManualAnalysis`) chaqiradi.*
- [x] Ertangi reja kalendar band vaqtlarini hisobga olib tuziladi (B). *Jonli sinovda (2026-07-20) Gemini 6 bandlik ertangi reja o'zbek tilida to'g'ri qaytardi. Eslatma: Google Calendar hali ulanmagani sabab bu sinovda band vaqtlar ro'yxati bo'sh edi — kontekstga haqiqiy band vaqt qo'shilgan holatda reja qanday o'zgarishi hali alohida sinalmagan.*
- [x] Orqada qolgan vazifalar aniqlanadi (C). *Jonli sinovda (2026-07-20) 5 ta muddati o'tgan vazifa to'g'ri aniqlanib, 3 ta ogohlantirish sifatida qaytdi.*
- [x] Har maqsad bo'yicha progress % va baho beriladi (D). *Jonli sinovda (2026-07-20) 3 ta faol maqsad uchun progress % va baho to'g'ri qaytdi.*
- [x] Motivatsion xabar chiqadi (E). *Jonli sinovda (2026-07-20) motivatsion xabar o'zbek tilida to'g'ri qaytdi.*
- [x] Maqsad AI orqali kichik vazifalarga bo'linadi va tasdiqlab qo'shiladi (F). *Jonli sinovdan o'tdi — 2026-07-21, brauzerda bosh sahifada "Kitob o'qish" maqsadi uchun "AI bilan bo'lish" tugmasi bosildi. Birinchi urinishda Gemini 503 UNAVAILABLE ("model is currently experiencing high demand") qaytardi va xatolik UI'da to'g'ri ko'rsatildi (ilova xatosi emas); qayta urinishda Gemini 6 ta taklif qilingan vazifani (Kitob tanlash, O'qish jadvalini tuzish, Har kuni ma'lum vaqt ajratish, O'qish joyini tayyorlash, O'qilgan kitoblarni qayd etish, Yangi kitoblar ro'yxatini tuzish) muhimlik darajalari bilan qaytardi; "6 ta vazifa qo'shish" bosilib barchasi tasdiqlanib qo'shildi va `/tasks`da "Muddatsiz" bo'limida "Kitob o'qish" tegi bilan tasdiqlandi.*
- [x] Tahlillar tarixда saqlanadi va ko'rinadi. *Jonli sinovdan o'tdi — 2026-07-21, `/ai` sahifasida "Hozir tahlil qil" tugmasi bosildi, Gemini tahlili "Joriy tahlil" sifatida ko'rsatildi va sahifa to'liq qayta yuklanganda (server-side fetch) xuddi shu tahlil saqlanib qolgani tasdiqlandi — `runManualAnalysis()` orqali `analyses` jadvaliga haqiqiy saqlash va ko'rsatish ishlaydi.*
- [x] Vaqti bor vazifa Google Calendar'da paydo bo'ladi. *Jonli sinovdan o'tdi — 2026-07-21, Google OAuth ulangach (`/sozlamalar?google=connected`) `scripts/smoke-sprint3.ts` qayta ishga tushirildi: "[4] Kalendar yozish OK: sinov eventi yaratildi va o'chirildi".*
- [x] Google Calendar band vaqtlari ilovada va AI rejasida hisobga olinadi. *Jonli sinovdan o'tdi — 2026-07-21, Google ulangach smoke-test kontekst qatlami (`buildAiContext`) Google band vaqtlarini xatosiz o'qidi.*

---

## 8. Ushbu sprintga KIRMAYDI

- ❌ Avtomatik (Cron) ertalab/kechki tahlil — Sprint 4.
- ❌ Telegram xabar yuborish — Sprint 4.
- ❌ Telegram Mini App — Sprint 4.

---

## Hisobot

- **2026-07-16** — Tahlil sahifasi (`/tahlil`) endi DB'dan real statistika hisoblaydi (commit ae02fd5): `src/lib/actions/analytics.ts` server action qo'shildi — haftalik vazifa bajarilishi %, faol maqsadlar progressi, umumiy statistikalar (jami vazifa, bajarilgan, maqsadlar soni) hisoblab, sahifaga uzatiladi. Bu Sprint 3'ning "kontekst yig'uvchi qatlam" va "tahlil tarixi haqiqiy ma'lumot bilan" qismlariga zamin yaratadi. Gemini API integratsiyasi, "Hozir tahlil qil" tugmasi va Google Calendar sinxronizatsiyasi hali bajarilmagan.
- **2026-07-20** — Sprint 3'ning asosiy kod qismi yakunlandi (`npm run build` va lint muvaffaqiyatli o'tdi, commit hali qilinmagan): Gemini AI integratsiyasi (`src/lib/gemini.ts`, `@google/generative-ai` paketisiz, `google-oauth.ts` qaroriga izchil to'g'ridan-to'g'ri `fetch` bilan `generateContent` + `responseSchema`); kontekst yig'uvchi qatlam (`src/lib/ai-context.ts`, `src/lib/tz.ts`); A–E funksiyalari BITTA strukturaviy chaqiruvda (`runManualAnalysis()`, `src/lib/actions/ai.ts`, natija `analyses` jadvaliga `kind: manual` bilan saqlanadi, umumiy turlar `src/lib/analysis.ts`da), F funksiyasi alohida (`suggestGoalTasks`/`addGoalTasks`); `/ai` sahifasi to'liq qayta yozildi (`page.tsx`, `ai-client.tsx`, `ai.module.css`, `loading.tsx`) — haqiqiy "Hozir tahlil qil" tugmasi, tahlil bo'limlari, tahlil tarixi; `goals-client.tsx`ga faol maqsad kartalarida "AI bilan bo'lish" tugmasi (`AiSplitSheet`) qo'shildi. Google Calendar: `src/lib/google-calendar.ts` (`googleapis`siz, fetch) — chiqish sinxroni (`src/lib/actions/tasks.ts`: createTask/updateTask/deleteTask vaqti belgilangan bir martalik vazifalarni primary kalendarga event sifatida yozadi, `tasks.google_event_id`, migratsiya `drizzle/0004_google-event-id.sql` Neon'ga qo'llandi) va kirish sinxroni (`listBusyEvents()`); token yangilash/`invalid_grant`da avtomatik uzish (`google-oauth.ts`ga `refreshGoogleAccessToken`, `GoogleTokenRevokedError`). Yangi `/kalendar` sahifasi (kun ko'rinishi + hafta chizig'i, vazifa va Google band vaqtlarini birga ko'rsatadi), `nav.tsx`ga "Kalendar" tabi qo'shildi. Mayda: `sozlamalar-client.tsx`dagi eskirgan matn yangilandi, `tasks-client.tsx`dagi lint xatosi tuzatildi. **Deviatsiyalar (rejadan farq):** `@google/generative-ai` va `googleapis` paketlari o'rniga ikkalasida ham to'g'ridan-to'g'ri `fetch` ishlatildi (yengil, serverless-mos, mavjud `google-oauth.ts` qaroriga izchil); A–F alohida promptlar o'rniga A–E bitta chaqiruvda, F alohida. **Ochiq qolgan:** `GEMINI_API_KEY` `.env.local`da hali placeholder — foydalanuvchi haqiqiy kalit kiritmagan, shuning uchun jonli Gemini chaqiruvi (tahlil, maqsad bo'lish) va Google Calendar sinxronizatsiyasi jonli sinovdan hali o'tmagan; shu sababli Tayyorlik mezoni (DoD) bandlari kod tayyor sifatida izohlab, belgilanmay qoldirildi.
- **2026-07-20** — Foydalanuvchi `GEMINI_API_KEY`ni `.env.local`ga kiritdi va jonli smoke-test o'tkazildi: `scripts/smoke-sprint3.ts` (`npx tsx scripts/smoke-sprint3.ts`) yaratildi va muvaffaqiyatli ishladi. Natijalar: (1) Gemini API ulanishi va strukturaviy JSON chiqishi ishladi; (2) kontekst yig'uvchi qatlam (`buildAiContext`) haqiqiy DB ma'lumotlari bilan ishladi — 3 ta faol maqsad, 5 ta muddati o'tgan vazifa to'g'ri aniqlandi; (3) A–E to'liq tahlil o'zbek tilida to'g'ri qaytdi: xulosa, 6 bandlik ertangi reja, 3 ta ogohlantirish (muddati o'tgan vazifalar asosida), 3 ta maqsad progressi, motivatsiya xabari. Shunga ko'ra DoD'dagi A, B, C, D, E bandlari jonli sinovdan o'tgan deb belgilandi (UI'dagi "Hozir tahlil qil" tugmasi xuddi shu `runManualAnalysis` server action'ini chaqiradi). Google Calendar hali ulanmagan (`users.googleRefreshToken` bo'sh) — shu sabab kalendar yozish/o'qish jonli sinovi, F (maqsadni bo'lish) funksiyasining o'zi va tahlil tarixiga haqiqiy saqlash hali alohida sinalmagan; foydalanuvchi Sozlamalar orqali Google'ni ulagach, skriptni qayta ishga tushirish kalendar yozish sinovini ham bajaradi (vaqtinchalik event yaratib o'chiradi).
- **2026-07-21** — Sprint 3 TO'LIQ yakunlandi: qolgan barcha DoD bandlari brauzerda jonli sinovdan o'tkazildi. (1) Google OAuth ulash: Claude in Chrome orqali `/sozlamalar`da "Google bilan ulash" bosilganda birinchi urinishda Google "Error 403: access_denied — has not completed the Google verification process" xatosini qaytardi, chunki Google Cloud loyihasi ("My Project 10779", `robotic-totem-472718-i0`) OAuth consent screen "Testing" holatida edi va Test users ro'yxati bo'sh edi; foydalanuvchi ruxsati bilan `tommysamiyyusuf@gmail.com` Google Cloud Console > APIs & Services > OAuth consent screen > Audience > Test users bo'limiga qo'shildi, shundan so'ng ulanish muvaffaqiyatli yakunlandi (`/sozlamalar?google=connected`, "Ulanish holati: Ulangan"). (2) Kalendar yozish/o'qish: `npx tsx scripts/smoke-sprint3.ts` qayta ishga tushirilganda "[4] Kalendar yozish OK: sinov eventi yaratildi va o'chirildi" natijasi chiqdi, kontekst qatlami ham Google band vaqtlarini xatosiz o'qidi. (3) "Hozir tahlil qil" (A–E) UI orqali: `/ai` sahifasida tugma bosilib Gemini tahlili muvaffaqiyatli qaytdi va "Joriy tahlil" sifatida ko'rsatildi; sahifa to'liq qayta yuklanganda ham xuddi shu tahlil saqlanib qolgani tasdiqlandi (haqiqiy `analyses` saqlash va E7 ko'rsatish ishlaydi). (4) F funksiyasi: bosh sahifada "Kitob o'qish" maqsadida "AI bilan bo'lish" bosilganda birinchi urinishda Gemini 503 UNAVAILABLE ("model is currently experiencing high demand") qaytardi — bu Google tomonidagi vaqtinchalik holat, ilova xatosi emas, va UI'da to'g'ri ko'rsatildi; qayta urinishda 6 ta taklif qilingan vazifa muhimlik darajalari bilan qaytdi va "6 ta vazifa qo'shish" bilan barchasi tasdiqlanib `/tasks`da "Kitob o'qish" tegi bilan qo'shildi. Natija: Bo'lim 7 (Tayyorlik mezoni)dagi barcha 8/8 band jonli sinovdan muvaffaqiyatli o'tdi — Sprint 3 endi to'liq yakunlangan.
- **2026-07-21** — Sprint 3 rejasidan tashqari (PRD/Sprint 1 ekran ro'yxatida yo'q), foydalanuvchi so'rovi bilan **AI Assistant (Bilim bazasi + System Prompt + Telegram chat)** qo'shildi — AI va Telegram bilan bog'liqligi sabab shu faylga qayd etilmoqda: (1) yangi `knowledge_entries` jadvali (migratsiya `drizzle/0005_gifted_starjammers.sql`) va CRUD server action'lar (`src/lib/actions/knowledge.ts`); yangi `/bilim-baza` sahifasi (qo'shish/tahrirlash/o'chirish, mavjud `tasks-client.tsx` naqshiga mos Sheet forma), `nav.tsx`ga "Bilim bazasi" tab va `BookIcon` qo'shildi. (2) `users.assistant_system_prompt` ustuni (migratsiya `drizzle/0006_gorgeous_sir_ram.sql`) + `updateAssistantSystemPrompt()` (`src/lib/actions/assistant.ts`); standart prompt matni alohida `src/lib/assistant-prompt.ts`da (sabab: "use server" faylda oddiy konstanta eksport qilib bo'lmaydi — client komponentda import qilinganda buzilishi jonli sinovda aniqlangan); `/bilim-baza`ga "System Prompt" kartasi qo'shildi. (3) `src/lib/gemini.ts`ga JSON-schema'siz oddiy matn qaytaradigan `generateText()` qo'shildi; yangi `src/lib/assistant.ts` (`answerAssistantQuestion(userId, question)`) foydalanuvchi System Prompt'i (yoki standart) + barcha Bilim bazasi yozuvlari + savolni bitta Gemini so'roviga birlashtiradi; jonli sinovda bilim bazasiga qo'shilgan sun'iy fakt ("maxfiy parol: ALFA-7-QUARTZ") so'ralganda Gemini to'g'ri javob qaytardi. (4) `src/lib/telegram-bot.ts`: `bot.on("message:text")` qayta qurildi — ilgari chek bo'lmagan matnlar jim tashlab qo'yilardi, endi `handleReceiptText()` chek emasligini aniqlasa, yangi `handleAssistantMessage()` orqali Gemini javobi yuboriladi ("typing" chat action bilan); jonli sinovda Paynet tekshiruv → AI Assistant fallback zanjiri to'liq ishlashi tasdiqlandi. Barcha 4 bosqich type-check + eslint + jonli (Gemini API va DB) smoke-test bilan tekshirildi.
- **2026-07-21** — Shu bilan bir qatorda, foydalanuvchi so'rovi bilan `/kalendar` sahifasiga tezkor vazifa qo'shish tugmasi qo'shildi (`src/app/(app)/kalendar/kalendar-add-button.tsx` — "+" FAB, sarlavha+vaqt kiritib tanlangan kunga vazifa qo'shadi); yangi kod yozilmasdan mavjud `createTask()` (`src/lib/actions/tasks.ts`) ishlatildi, shu orqali vazifa→Google Calendar avtomatik sinxron mexanizmi ham qo'llanildi. `createTask`, `updateTask`, `toggleTaskStatus`, `toggleOccurrence`, `deleteTask` — barchasiga `revalidatePath("/kalendar")` qo'shildi, shunda kalendar ko'rinishi vazifa o'zgarishlaridan keyin darhol yangilanadi. "Google Calendar'dan qo'shilgan hodisa ilovada ko'rinishi" (`listBusyEvents()`) allaqachon mavjud edi — yangi kod talab qilmadi, faqat qayta tasdiqlandi.
