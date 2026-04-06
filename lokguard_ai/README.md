# LokGuard - TinyBheema

TinyBheema is a React + Vite web app for gig-worker micro-insurance, now migrated to Supabase.

## Stack

- Frontend: React + Vite
- Auth: Supabase Auth (email/password + email OTP)
- Database: Supabase Postgres (`users` table)
- Storage: Supabase Storage (`user-documents` bucket)
- OTP emails: Supabase Auth default email service (no custom SMTP configuration required)

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Required keys:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 3. Supabase setup

Run the SQL in `supabase/schema.sql` in your Supabase SQL editor.

This creates:

- `public.users` table keyed by `auth.users.id`
- RLS policies so users can read/update their own row

If you see `Could not find the table 'public.users' in the schema cache`, rerun the SQL script and make sure the schema cache is reloaded. The script now ends with a `NOTIFY pgrst, 'reload schema';` so PostgREST can pick up the new table.

Create a public storage bucket named `user-documents`.

## 4. Auth flow

- Login supports email/password and email OTP.
- Password login accepts email or phone; phone is resolved to email using the `resolve_login_email` SQL function.
- OTP login uses `supabase.auth.signInWithOtp({ email })`.
- OTP verification uses `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
- Profile page also supports email verification using OTP.
- Registration creates a Supabase Auth account with email/password and stores a profile row in `public.users`.
- After login or registration, the app loads the profile from `public.users` and opens the dashboard.

## 5. Supabase Edge Function (optional example)

Edge function source: `supabase/functions/send-email-otp/index.ts`

This function is optional and not used by the login OTP flow in the app. The app uses Supabase Auth email OTP directly.

Deploy with Supabase CLI:

```bash
supabase functions deploy send-email-otp
```

Set secrets:

```bash
supabase secrets set RESEND_API_KEY=your_key
supabase secrets set OTP_FROM_EMAIL="TinyBheema <noreply@yourdomain.com>"
```

## 6. Run locally

```bash
npm run dev
```

## 7. Vercel deployment

Set these env vars in Vercel project settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The app is static and deploys with Vite output.
