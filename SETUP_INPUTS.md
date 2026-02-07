# Siz berishingiz kerak bo'lgan ma'lumotlar

Quyidagi qiymatlarni to'ldirsangiz loyiha productionga tayyor bo'ladi.

## 1) Frontend (`app.config.js`)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anon public key
- `VAPID_PUBLIC_KEY`: Web Push public key

## 2) Server env (`Vercel Project -> Settings -> Environment Variables`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (masalan: `mailto:admin@example.com`)

## 3) Supabase sozlamalari
- `supabase/schema.sql` ni ishga tushirish
- Auth -> Email login yoqilgan bo'lishi
- Auth redirect URL: deploy domeningiz (masalan: `https://your-app.vercel.app`)

## 4) Ixtiyoriy, lekin tavsiya
- `words` jadvalini `data/a1a2-words.json` bilan to'ldirish
  Eslatma: to'ldirilmasa ham app lokal JSON fallback bilan ishlaydi.
