# Aaha Central

Central Kitchen operations platform for [Aaha Truly South](https://aahatrulysouth.com/) — connecting the central kitchen admin team with every branch.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4** + **shadcn/ui** (Radix)
- **Supabase** — Postgres, Auth, RLS
- **TypeScript**

## Two experiences, one app

- `/admin/*` — Central Admin console (desktop-first, fully responsive)
  Dashboard · Stock · Catalog · Orders · Dispatch · Branches · Users · Invoices · Reports · Notifications · Settings
- `/branch/*` — Branch Manager app (mobile-first with desktop sidebar)
  Home · Order · Catering · Invoices · Notifications · Profile

Auth is shared. Role is resolved server-side from `profiles.role`; middleware redirects each user to the correct area.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase values
npm run dev
```

Environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

## Database

Schema, RLS policies, triggers and helper functions live in Supabase. See migration notes in project history — six core tables (`locations`, `profiles`, `catalog_items`, `orders`, `order_lines`, `catering_events`) with row-level security scoping every branch manager to their own location.

## Design system

Component primitives live in `src/components/shared/` and are composed by page files. Anything used more than once (dialogs, tables, filters, empty states, sign out) is factored there rather than inlined.
