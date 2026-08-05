# What went wrong: three console warnings

Checkout itself is working — the payment page renders and the Stripe form loads. What you're seeing in the console are three React warnings coming from other parts of the app. None of them break functionality, but all three are real bugs worth fixing.

## 1. `hreflang` written with the wrong casing (pricing page)

`src/routes/pricing.tsx` declares alternate-language links with `hreflang`. React expects the JSX property name `hrefLang`, so the attribute is dropped and the warning `Invalid DOM property hreflang. Did you mean hrefLang?` appears. Result: search engines never see the JA/EN alternates on that page.

Fix: rename the three keys to `hrefLang` in the route's `head()` links. The sitemap file is raw XML — it stays as `hreflang` there and needs no change.

## 2. Invalid HTML nesting in Admin -> Students

Around line 447 of `src/routes/admin.students.tsx`, a `<Badge>` (which renders a `<div>`) is placed inside a `<p>`. A `<div>` can't live inside a `<p>`, which is what produces the "cannot be a descendant of p" plus hydration-error warnings.

Fix: change the wrapper from `<p>` to a `<div>` (or a `<span>` with flex) keeping the same classes, so the badge and the enrollment date render inside a valid container.

## 3. Language hydration mismatch on `<html lang>`

`src/routes/__root.tsx` always renders `<html lang="ja">` on the server, while the browser language detector (localStorage `app.lang`, then browser locale) can resolve to `en`. The attribute is currently updated inside a `requestAnimationFrame` that can fire during hydration, so React compares a changed `lang` against the server HTML and logs the mismatch.

Fix: move the `lang` application so it only runs after hydration completes — apply it from a mount effect in the root component instead of from the i18n module's init/`languageChanged` path during hydration. The server keeps emitting `lang="ja"` (the default language), and the client switches it once, after hydration, with no mismatch.

## Technical notes

- Files touched: `src/routes/pricing.tsx`, `src/routes/admin.students.tsx`, `src/routes/__root.tsx`, `src/lib/i18n.ts`.
- Presentation/metadata only: no payment, database, RLS, or business-logic changes.
- Verification: rebuild, open `/pricing`, `/admin/students`, and `/checkout`, and confirm the console is clean.
