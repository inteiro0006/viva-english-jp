# E2E tests (Playwright)

Run: `bun run test:e2e` (uses the dev server on :8080, starting it if needed).

The Google/Apple provider consent screen is never contacted. Instead the tests
mock:

- `/~oauth/*` — the Lovable OAuth broker, replaced by an instant bounce to the
  `redirect_uri` the app requested (asserted to be `/auth/callback`).
- `**/auth/v1/*` and `**/rest/v1/user_roles*` — a fake Supabase session plus the
  role rows that drive routing.

Covered: social buttons present on `/register` and `/login`, session-less
callback → `/login`, student → `/student/dashboard`, admin → `/admin`, no role →
`/pricing`, and full mocked OAuth round trip.
