# Security

## Credential exposure remediation (REQUIRED — do this now)

The migration `supabase/migrations/20260729014835_05774cfb-3571-44c7-90bc-3cfdc9653345.sql`
contains a direct `UPDATE auth.users` statement that sets a **hardcoded
password** for a real account. The value is committed to Git history, so it
must be treated as permanently compromised.

Migration files are managed by the platform and cannot be rewritten from the
app codebase, and Git history must not be rewritten. Therefore the mitigation
is **credential rotation**, not file editing.

Owner actions, in order:

1. Change the password of the affected account immediately through the
   platform auth UI / password-reset flow. Do **not** reuse the leaked value.
2. Revoke all active sessions for that account (sign out everywhere), so any
   session minted with the leaked password is invalidated.
3. Review authentication logs for sign-ins between the migration date
   (2026-07-29) and the rotation, from unexpected IPs or user agents.
4. Confirm the account's `admin` role assignment in `public.user_roles` is
   still the expected one and no extra role rows were added.

Rules going forward:

- Passwords are **never** set or changed via SQL.
- Migrations never touch `auth.*`, `storage.*`, or any other managed schema.
- Migrations never embed personal e-mail addresses, tokens, or secrets.

## Repository credential scan (2026-07-31)

Scanned for: passwords, private keys, Stripe live/test secret keys, Stripe
webhook secrets, Cloudflare API tokens, `service_role` keys.

| File | Type | Status / action |
| --- | --- | --- |
| `supabase/migrations/20260729014835_*.sql` | Hardcoded account password + personal e-mail | **Exposed.** Rotate credentials per the section above. File is platform-managed and cannot be edited. |
| `src/integrations/supabase/client.server.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Reference only, read from `process.env` on the server. OK. |
| `src/lib/payments/stripe-handlers.server.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Reference only, server-only module. OK. |
| `ARCHITECTURE.md` | Variable **name** only | OK. |
| `.env` / `.env.development` | Publishable/anon keys only | Platform-managed. No secret values. OK. |

No Stripe secret keys, webhook secrets, Cloudflare API tokens, or private key
material were found in the repository.

## Secret handling rules

- Server-only secrets are read with `process.env.*` **inside** handlers.
- Never expose a secret through a `VITE_*` variable — those are bundled into
  the browser build.
- Never log, return, or echo secret values.

Required server-side variable **names** (values are configured in the platform
secret store, never in the repo):

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SANDBOX_API_KEY
STRIPE_LIVE_API_KEY
PAYMENTS_SANDBOX_WEBHOOK_SECRET
PAYMENTS_LIVE_WEBHOOK_SECRET
PAYMENTS_ENVIRONMENT          # "sandbox" | "live" (server-resolved)
SITE_URL                      # allowlisted origin for checkout redirects
LOVABLE_API_KEY
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_STREAM_API_TOKEN
CLOUDFLARE_STREAM_SIGNING_KEY_ID
CLOUDFLARE_STREAM_SIGNING_KEY_PEM
CLOUDFLARE_STREAM_WEBHOOK_SECRET
```

## Payment trust boundaries

- `authenticated` has **SELECT only** on `orders` and `enrollments`, and no
  access at all to `payment_events`.
- Orders are created exclusively by server functions using the service role.
- The client never supplies `user_id`, `course_id`, price, currency,
  environment, or redirect URLs — all are resolved server-side.
- Sandbox payments never grant enrollment (`fulfill_paid_order` only grants
  when `environment = 'live'`).
