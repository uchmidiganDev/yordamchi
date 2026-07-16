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

- [ ] Gemini API integratsiyasi va strukturaviy JSON chiqish.
- [ ] Kontekst yig'uvchi qatlam (vazifa/maqsad/kalendar ma'lumotini yig'ish).
- [ ] A–F funksiyalarini prompt orqali amalga oshirish.
- [ ] "Hozir tahlil qil" tugmasi → tahlil → saqlash → ko'rsatish.
- [ ] Tahlil tarixi (E7) haqiqiy ma'lumot bilan.
- [ ] "AI bilan bo'lish" (F) → taklif → tasdiqlab qo'shish.
- [ ] Google Calendar chiqish sinxroni (vazifa → event).
- [ ] Google Calendar kirish (band vaqtlarni o'qish).
- [ ] Kalendar ko'rinishi (E5) da vazifa + band vaqtlarni birga ko'rsatish.
- [ ] Token yangilash / xatoликda qayta ulash.

---

## 6. Deliverable (Aniq natija)

Foydalanuvchi tugma bosganda Gemini to'liq tahlil (xulosa, ertangi reja,
ogohlantirish, progress, motivatsiya) beradi va natija saqlanadi; katta maqsad
kichik vazifalarga bo'linadi; vazifalar Google Calendar bilan ikki tomonlama
sinxronlanadi va band vaqtlar rejaga ta'sir qiladi.

---

## 7. Tayyorlik mezoni (Definition of Done)

- [ ] "Tahlil qil" bosilganda Gemini bugungi holatni tahlil qiladi (A).
- [ ] Ertangi reja kalendar band vaqtlarini hisobga olib tuziladi (B).
- [ ] Orqada qolgan vazifalar aniqlanadi (C).
- [ ] Har maqsad bo'yicha progress % va baho beriladi (D).
- [ ] Motivatsion xabar chiqadi (E).
- [ ] Maqsad AI orqali kichik vazifalarga bo'linadi va tasdiqlab qo'shiladi (F).
- [ ] Tahlillar tarixда saqlanadi va ko'rinadi.
- [ ] Vaqti bor vazifa Google Calendar'da paydo bo'ladi.
- [ ] Google Calendar band vaqtlari ilovada va AI rejasida hisobga olinadi.

---

## 8. Ushbu sprintga KIRMAYDI

- ❌ Avtomatik (Cron) ertalab/kechki tahlil — Sprint 4.
- ❌ Telegram xabar yuborish — Sprint 4.
- ❌ Telegram Mini App — Sprint 4.

---

## Hisobot

- **2026-07-16** — Tahlil sahifasi (`/tahlil`) endi DB'dan real statistika hisoblaydi (commit ae02fd5): `src/lib/actions/analytics.ts` server action qo'shildi — haftalik vazifa bajarilishi %, faol maqsadlar progressi, umumiy statistikalar (jami vazifa, bajarilgan, maqsadlar soni) hisoblab, sahifaga uzatiladi. Bu Sprint 3'ning "kontekst yig'uvchi qatlam" va "tahlil tarixi haqiqiy ma'lumot bilan" qismlariga zamin yaratadi. Gemini API integratsiyasi, "Hozir tahlil qil" tugmasi va Google Calendar sinxronizatsiyasi hali bajarilmagan.
