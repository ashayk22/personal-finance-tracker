# Moneta — Personal Finance

Standalone Next.js 15 finance application with Supabase Auth, Google OAuth, and user-scoped Postgres data. The public routes are `/` and `/login`; all finance routes under `/app/finance` require a session. The client uses only the Supabase project URL and publishable/anon key. Row Level Security is the database security boundary.

## Local setup

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase Project Settings → API. Never use a service-role key in this client application.
2. Configure Google as an Auth provider in Supabase. In Google Cloud, add the application origins (`http://localhost:3000` for local work and your final HTTPS site origin for production). Add the Supabase provider callback shown in Supabase's Google provider setup as the Google authorized redirect URI (for this project: `https://dkeslymifybzesmyxksi.supabase.co/auth/v1/callback`).
3. In Supabase Auth → URL Configuration, set the Site URL to the final production origin and allow the exact callback URLs used by the application: `http://localhost:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback`, and `https://<your-production-domain>/auth/callback`.
4. Run `npm install`, `npm run dev`, and open `http://localhost:3000`.

## Existing production data and migration safety

The production database migration history is synchronized with the six migrations in this repository. The multi-user security migration and the one-time legacy ownership claim were applied to production and verified on November 20, 2026. The original financial rows were preserved and ownership was updated in place. At claim time, the verified baseline was 16 categories, 6 payment methods, 8 transactions, 1 budget, 2 commitments, and 0 commitment payments; these counts can change as the app is used.

The repository is public, so it intentionally contains no account UUIDs or financial snapshots. Local backup files under supabase/backups/ are ignored and must never be committed or uploaded.

The migration version numbers match production, but the public SQL is not byte-for-byte identical to the private production execution: owner-specific UUIDs were removed after the one-time claim. The first auth migration is a UUID-free equivalent with safe empty-workspace bootstrap behavior; the second is only a non-mutating post-claim assertion. Do not use these public files to repeat or reconstruct the private production claim.

Do not re-run the production ownership claim. The public 20261120010000_confirmed_legacy_owner_claim.sql is a fail-closed post-claim assertion and does not reassign records. For another database that contains legacy-owned finance rows, prepare a separate private ownership claim only after confirming the owner identity and creating a restorable backup. The readiness function denies access while finance rows are not linked to valid Auth users. A fresh empty database may be used by its first authenticated user without inheriting another user's records.

After restoring or setting up a database, verify the migration history and RLS policies, then test with two distinct Google accounts. One account must never read or mutate the other's records.
## Features

- Google sign-up/sign-in, OAuth callback, persisted sessions, protected finance routes, and sign-out.
- Transactions, categories, budgets, analytics, investments, insurance, recurring commitments, and Excel/CSV/PDF exports.
- Light/dark theme, responsive layout, PWA installation, shimmer skeletons, reduced-motion-aware transitions, and optional persisted button sounds (off by default).
- Empty states use live Supabase data only; no financial demo records are generated.

## Scripts

- `npm run dev` — local development.
- `npm run typecheck` — TypeScript check.
- `npm run build` — production build.
- `npm start` — run a production build.
