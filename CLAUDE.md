# CLAUDE.md — Yordamchi loyihasi

AI maqsad-vazifa boshqaruv platformasi (shaxsiy vosita). To'liq texnik hujjat
`PRD.md` da, sprint rejalari `sprints/` papkasida, vizual holat `dashboard.html` da.

## Avtomatlashtirish qoidalari (MAJBURIY)

Ushbu loyihada **`hisobotchi`** nomli custom subagent mavjud
(`.claude/agents/hisobotchi.md`). Uni quyidagi ikki holatда ishga tushirish shart:

1. **Sprint ichidagi biror vazifa bajarilganda** — hisobotchi agentini chaqir,
   toki sprint fayli, qarorlar va dashboard yangilansin.
2. **GitHub'ga `git push` qilishdan oldin** — avval hisobotchi agentini chaqir,
   uning o'zgarishlarini commit qil, so'ng push qil. (Push oldidan
   `pre_push_reminder.sh` hook ham eslatib turadi.)

Hisobotchi agent kod yozmaydi — u faqat hisobot, holat va hujjatlarni sinxronlaydi:
sprint fayllarini hisobot bilan to'ldiradi, bajarilgan vazifalarni `[x]` belgilaydi,
qarorlarni shu faylning "Qabul qilingan qarorlar" bo'limiga yozadi va
`dashboard.html` ni aktual holat bilan moslaydi.

## Qabul qilingan qarorlar

> Bu bo'lim loyiha davomida qabul qilingan texnik va mahsulot qarorlarini
> yuritadi. Hisobotchi agent yangi qarorlarni shu yerga qo'shib boradi.

- **[2026-07-07]** — Mahsulot turi: shaxsiy vosita (bitta foydalanuvchi), murakkab rollar/ruxsatlar tizimisiz.
- **[2026-07-07]** — Ma'lumot tuzilmasi: ikki bosqichli — Maqsad → Vazifa.
- **[2026-07-07]** — Vazifalar: bir martalik va takrorlanuvchi, barcha atributlar bilan (vaqt, sana, prioritet, davomiylik, holat).
- **[2026-07-07]** — AI modeli: Google Gemini API. Sabab: Google Calendar ekotizimi bilan mos.
- **[2026-07-07]** — AI funksiyalari: kunlik tahlil, ertangi reja, orqada qolganlarni aniqlash, maqsad progressi, motivatsiya, maqsadni bo'lish.
- **[2026-07-07]** — Kalendar: Google Calendar ikki tomonlama sinxron; band vaqtlar rejaga hisobga olinadi.
- **[2026-07-07]** — Ilova turi: veb-ilova + Telegram bot + Telegram Mini App (alohida mobil ilova yo'q).
- **[2026-07-07]** — Autentifikatsiya: Telegram (asosiy kirish) + Google OAuth (kalendar uchun).
- **[2026-07-07]** — Til: interfeys va AI xabarlari o'zbek tilida.
- **[2026-07-07]** — Hosting va baza: Vercel + Neon PostgreSQL (bepul tarif). Sabab: serversiz, always-on, Cron mavjud.
- **[2026-07-07]** — Texnologiya: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Drizzle ORM + grammY + googleapis.
- **[2026-07-07]** — Eslatmalar: faqat kunlik (ertalab reja + kechqurun tahlil), har vazifa uchun alohida eslatma yo'q.
- **[2026-07-14]** — Vercel loyihasi (`yordamchi`) GitHub repo (`uchmidiganDev/yordamchi`) bilan avtomatik bog'landi (GitHub push → avtomatik deploy). Sabab: CI/CD pipeline sprint ishlari boshlanishidan oldin tasdiqlanishi kerak edi; test `index.html` fayli orqali deploy workflow muvaffaqiyatli tekshirildi.
