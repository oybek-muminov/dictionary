# LugatLab

Ingliz tili lugatini yodlash uchun web-ilova.

## Features
- Email magic-link login (Supabase Auth)
- A1-A2 darajadagi 10 savollik quiz
- Progress va statistika
- Daily push reminder (Vercel Cron + Web Push)

## Project Structure
- `index.html`, `styles.css`, `app.js`
- `supabaseClient.js`, `progressService.js`, `quizEngine.js`, `pushService.js`
- `sw.js`
- `api/push/subscribe.js`
- `api/jobs/send-daily-reminders.js`
- `data/a1a2-words.json`
- `supabase/schema.sql`
- `vercel.json`

## Setup

### 1. Supabase
1. Supabase project yarating.
2. `supabase/schema.sql` faylini SQL Editor orqali ishga tushiring.
3. Auth -> Providers ichida Email loginni yoqing.
4. Auth -> URL Configuration ichida deploy domenini redirect URL sifatida qo'shing.
5. `words` jadvaliga `data/a1a2-words.json` ma'lumotlarini import qiling.
Fallback sifatida ilova lokal JSON fayldan ham ishlay oladi.

### 2. Frontend Config
`app.config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  VAPID_PUBLIC_KEY: "YOUR_VAPID_PUBLIC_KEY"
};
```

### 3. Vercel Environment Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (masalan: `mailto:admin@example.com`)

`CRON_SECRET` qiymati cron endpointga `Authorization: Bearer <CRON_SECRET>` formatida yuboriladi.

### 4. Local Run
```bash
npm install
npm run dev
```

## Verification Checklist
- Magic link yuborish va kirish ishlaydi.
- Quiz 10 savol bilan ishlaydi va ball to'g'ri hisoblanadi.
- Natija saqlanadi va statistikada ko'rinadi.
- Reminder yoqilganda notification permission so'raladi.
- `POST /api/push/subscribe` -> `200 { ok: true }`.
- `POST /api/jobs/send-daily-reminders` noto'g'ri token bilan `401`, to'g'ri token bilan `200`.

## Additional Notes
Batafsil konfiguratsiya ro'yxati: `SETUP_INPUTS.md`.
