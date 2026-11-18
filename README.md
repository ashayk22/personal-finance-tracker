# Moneta — Personal Expense Tracker

Standalone Next.js finance tracker using Supabase PostgREST and PostgreSQL. The app opens directly to the dashboard and has no login flow. Anonymous database access is restricted by RLS to one configured finance owner; anyone who can reach this app and its public Supabase key can read and modify that owner's finance records.

## Setup
Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY using Supabase Project Settings → API. Never place a service-role key in this client app. Apply all migrations under supabase/migrations in timestamp order, then run npm install and npm run dev. Open / or /app/finance.

Scripts: npm run dev, npm run typecheck, npm run build, npm start.
Routes: /app/finance, /app/finance/transactions, /app/finance/budgets, /app/finance/analytics, /app/finance/categories.
