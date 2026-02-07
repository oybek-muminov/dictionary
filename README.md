# LugatLab

Ingliz tili lugat yodlash uchun mini-platforma:
- Email magic-link login (Supabase)
- A1-A2 quiz (10 savol)
- Progress/statistika
- Daily push reminder (Vercel Cron + Web Push)

## Loyihadagi asosiy fayllar
- `index.html`, `styles.css`, `app.js`
- `supabaseClient.js`, `progressService.js`, `quizEngine.js`, `pushService.js`
- `sw.js`
- `api/push/subscribe.js`
- `api/jobs/send-daily-reminders.js`
- `data/a1a2-words.json`
- `supabase/schema.sql`
- `vercel.json`

## 1) Supabase sozlash
1. Supabase loyihasi oching.
2. `supabase/schema.sql` faylini SQL editor orqali ishga tushiring.
3. Auth -> Providers ichida Email kirishni yoqing.
4. URL Configuration ichida redirect URL sifatida deploy domeningizni kiriting.
5. `words` jadvaliga `data/a1a2-words.json`dagi sozlarni import qiling (yoki app lokal fallbackdan foydalanadi).

## 2) Frontend config
`app.config.js` faylini to'ldiring:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  VAPID_PUBLIC_KEY: "YOUR_VAPID_PUBLIC_KEY"
};
```

## 3) Vercel env
Vercel'da quyidagi envlarni kiriting:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (masalan: `mailto:admin@example.com`)

`CRON_SECRET` bo'lsa, Vercel cron so'rovlarida `Authorization: Bearer <CRON_SECRET>` yuboriladi.

## 4) Ishga tushirish
```bash
npm install
npm run dev
```

## Test checklist
- Magic link yuborish va kirish ishlaydi.
- Quiz 10 savol bilan ishlaydi, ball to'g'ri chiqadi.
- Natija saqlanib statistikada ko'rinadi.
- Reminder yoqilganda notification permission so'raladi.
- `/api/push/subscribe` `200 { ok: true }` qaytaradi.
- `/api/jobs/send-daily-reminders` noto'g'ri token bilan `401`, to'g'ri token bilan `200`.

## Sizdan kerak bo'ladigan inputlar
`SETUP_INPUTS.md` fayliga qarang.
