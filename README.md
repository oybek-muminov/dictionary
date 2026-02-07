# LugatLab

LugatLab - inglizcha sozlarni kundalik quiz orqali yodlashga yordam beradigan web ilova.
Maqsad: foydalanuvchi 10 ta savollik sessiyalar bilan lugatni mustahkamlashi, progressini saqlashi va daily reminder olishi.

## Asosiy imkoniyatlar
- Email magic-link login (Supabase Auth)
- A1-A2 darajadagi quiz (10 savol)
- Progress va statistika
- Daily push reminder (Vercel Cron + Web Push)

## Tez sozlash
1. Supabase'da `supabase/schema.sql` ni ishga tushiring.
2. Supabase Auth'da Email loginni yoqing va deploy domenini redirect URL ga qo'shing.
3. `app.config.js` ni to'ldiring:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  VAPID_PUBLIC_KEY: "YOUR_VAPID_PUBLIC_KEY"
};
```

4. Vercel env qiymatlarini kiriting:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

5. Lokal ishga tushirish:

```bash
npm install
npm run dev
```

## Eslatma
- Sozlar bazasini `words` jadvaliga import qilsangiz yaxshi, import qilinmasa app `data/a1a2-words.json` fallbackdan ishlaydi.
- Batafsil inputlar ro'yxati: `SETUP_INPUTS.md`.
