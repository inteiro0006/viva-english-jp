import type { Page } from "@playwright/test";

/**
 * Test doubles for the auth stack.
 *
 * The real Google/Apple flow needs an external consent screen, which cannot run
 * in CI. Instead we mock the two things the app actually depends on:
 *   1. the OAuth broker redirect (`/~oauth/*`) — replaced by an immediate bounce
 *      back to the app callback, exactly like a successful provider round trip;
 *   2. the Supabase session + `user_roles` reads that drive role routing.
 */

export type MockRole = "student" | "admin";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://jzcqpytfqoikomnrdkfl.supabase.co";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fakeSession(userId: string, email: string) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
    sub: userId,
    email,
    role: "authenticated",
    aud: "authenticated",
    exp,
  })}.mock-signature`;

  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: { full_name: "Test User" },
    identities: [],
    created_at: new Date().toISOString(),
  };

  return {
    access_token: accessToken,
    refresh_token: "mock-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user,
  };
}

/** Intercepts Supabase auth + user_roles so no real backend call is made. */
export async function mockSupabase(
  page: Page,
  opts: { userId: string; email: string; roles: MockRole[] },
) {
  const session = fakeSession(opts.userId, opts.email);

  await page.route("**/auth/v1/user**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session.user),
    }),
  );

  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
    }),
  );

  await page.route("**/rest/v1/user_roles**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(opts.roles.map((role) => ({ role }))),
    }),
  );

  return session;
}

/** Writes the mocked session into localStorage for the app origin. */
export async function seedSession(page: Page, session: object, baseURL: string) {
  await page.goto(baseURL);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(session)] as const,
  );
}

/**
 * Mocks the Lovable OAuth broker: any `/~oauth/*` navigation immediately
 * bounces to the `redirect_uri` the app asked for, simulating provider consent.
 */
export async function mockOAuthBroker(page: Page, onInitiate: (url: URL) => void) {
  await page.route("**/~oauth/**", async (route) => {
    const url = new URL(route.request().url());
    onInitiate(url);
    const redirectUri =
      url.searchParams.get("redirect_uri") ?? "http://localhost:8080/auth/callback";
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<html><body><script>location.replace(${JSON.stringify(redirectUri)})</script></body></html>`,
    });
  });
}
