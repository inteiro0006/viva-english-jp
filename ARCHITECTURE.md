# Architecture — Eigo Michi (Scaffold Step 1)

## Stack

- TanStack Start v1 (React 19, Vite 7) — file-based routing under `src/routes/`.
- TypeScript strict, Tailwind CSS v4 (design tokens in `src/styles.css`).
- shadcn/ui + Radix + Lucide Icons.
- TanStack Query (client cache), React Hook Form + Zod (forms, later).
- i18next + react-i18next + language detector (ja default, en secondary).
- Supabase (Auth, Postgres, RLS, Edge Functions) — **not wired yet**.
- Cloudflare Stream — **not wired yet**.
- Stripe Checkout (one-time payment) — **not wired yet**.

## Folder layout

```
src/
  routes/               # File-based routes (public / student / admin)
    student.tsx         # Layout wrapper (renders <StudentLayout><Outlet/></StudentLayout>)
    admin.tsx           # Layout wrapper
    ...                 # Placeholder pages for every required route
  components/
    layout/             # PublicLayout, StudentLayout, AdminLayout
    ui/                 # shadcn primitives
    LanguageSwitcher.tsx
    Placeholder.tsx
  lib/
    i18n.ts             # i18next init, ja default, updates <html lang>
    utils.ts
  locales/
    ja/common.json
    en/common.json
```

## Roles

Two roles: `student`, `admin`. Roles will live in a `user_roles` table with a
`has_role(uuid, app_role)` `SECURITY DEFINER` function; RLS on content tables
will call `has_role`. **Frontend gates are cosmetic only** — real access is
enforced by RLS + Edge Function checks.

## Routing

- Public routes: `/`, `/course`, `/pricing`, `/login`, `/register`,
  `/forgot-password`, `/reset-password`, `/checkout`, `/payment/success`,
  `/payment/cancel`, `/terms`, `/privacy`.
- Student routes (auth required, added in next step): `/student/dashboard`,
  `/student/course/$courseSlug`, `/student/lesson/$lessonId`,
  `/student/profile`, `/student/support`.
- Admin routes (admin role required): `/admin`, `/admin/courses`,
  `/admin/courses/$courseId`, `/admin/modules`, `/admin/lessons`,
  `/admin/videos`, `/admin/students`, `/admin/orders`, `/admin/settings`.

Auth gates will move student/admin routes under `_authenticated/` once
Supabase is enabled.

## Design system

Tokens in `src/styles.css` (oklch):

- `--brand` #008061 (green, primary CTA)
- `--highlight` #F5821F (orange, emphasis)
- `--urgent` / `--destructive` #ED1B2D (used sparingly)
- `--teal` petrol complementary
- Neutral, light backgrounds; generous whitespace; rounded-lg default.

Font stack: Noto Sans JP + Noto Serif JP (via system fallback for now; web
fonts can be added in `__root.tsx` head as `<link>` tags — Tailwind v4 does
not allow remote `@import` in `styles.css`).

## i18n

- Default: `ja`. Secondary: `en`. Preference persisted in `localStorage`
  under `app.lang`.
- `<html lang>` auto-updates on language change.
- All UI text lives in `src/locales/{ja,en}/common.json`; no hard-coded
  strings in components (only structural labels like the 英 mark).

## Placeholder status

Every route renders a real, translated placeholder page. No dummy data is
hard-coded as if it were real content. Payment, video streaming and full
database schemas are intentionally deferred.

## Environment variables (future steps)

Client-visible (`VITE_*` for Vite / `import.meta.env`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`

Server-only (Edge Functions / server fns, never in the frontend bundle):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `CLOUDFLARE_STREAM_SIGNING_KEY_ID`
- `CLOUDFLARE_STREAM_SIGNING_KEY_PEM`

## What is still placeholder

- No authentication (Supabase not enabled yet).
- No database schema, no RLS policies.
- No Stripe Checkout session creation.
- No Cloudflare Stream signed playback.
- No real course/module/lesson content — pages render translated shells.
- No admin role check — admin routes are reachable in dev; will be gated
  after Supabase is enabled.

## Next steps

1. Enable Lovable Cloud (Supabase) and create the schema
   (`courses`, `stages`, `modules`, `lessons`, `user_roles`,
   `progress`, `orders`) with GRANTs, RLS, and `has_role`.
2. Auth pages (login/register/reset) wired to Supabase Auth.
3. Move student/admin routes under `_authenticated/` with the role-gated
   layout.
4. Stripe Checkout via a TanStack server function; webhook via
   `/api/public/stripe-webhook`.
5. Cloudflare Stream signed URLs from an Edge Function; lesson player.
6. Progress tracking + admin CRUD.
