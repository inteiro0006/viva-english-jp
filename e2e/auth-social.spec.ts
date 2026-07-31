import { expect, test } from "@playwright/test";
import { mockOAuthBroker, mockSupabase, seedSession } from "./helpers/auth-mocks";

const BASE = "http://localhost:8080";

test.describe("social sign-in", () => {
  test("register page exposes Google and Apple sign-in", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Apple/i })).toBeVisible();
  });

  test("login page exposes Google and Apple sign-in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Apple/i })).toBeVisible();
  });

  test("callback without a session sends the visitor back to /login", async ({ page }) => {
    await page.goto("/auth/callback");
    await page.waitForURL("**/login", { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  test("student session lands on the student dashboard", async ({ page }) => {
    const session = await mockSupabase(page, {
      userId: "11111111-1111-4111-8111-111111111111",
      email: "student@example.com",
      roles: ["student"],
    });
    await seedSession(page, session, BASE);
    await page.goto("/auth/callback");
    await page.waitForURL("**/student/dashboard", { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/student/dashboard");
  });

  test("admin session lands on the admin area", async ({ page }) => {
    const session = await mockSupabase(page, {
      userId: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.com",
      roles: ["admin"],
    });
    await seedSession(page, session, BASE);
    await page.goto("/auth/callback");
    await page.waitForURL("**/admin", { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/admin");
  });

  test("session without roles lands on pricing", async ({ page }) => {
    const session = await mockSupabase(page, {
      userId: "33333333-3333-4333-8333-333333333333",
      email: "noroles@example.com",
      roles: [],
    });
    await seedSession(page, session, BASE);
    await page.goto("/auth/callback");
    await page.waitForURL("**/pricing", { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/pricing");
  });

  test("Google button starts OAuth with a public same-origin redirect_uri and returns to the student area", async ({
    page,
  }) => {
    const session = await mockSupabase(page, {
      userId: "44444444-4444-4444-8444-444444444444",
      email: "oauth@example.com",
      roles: ["student"],
    });

    let initiateUrl: URL | null = null;
    await mockOAuthBroker(page, (url) => {
      initiateUrl = url;
    });

    await page.goto("/register");
    await page.waitForLoadState("networkidle");
    // Provider consent is mocked: the session is what a successful round trip
    // would have produced, written before the broker bounces back.
    await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
      "sb-jzcqpytfqoikomnrdkfl-auth-token",
      JSON.stringify(session),
    ] as const);

    await page.getByRole("button", { name: /Google/i }).click();
    await page.waitForURL(/\/student\/dashboard/, { timeout: 25_000 });

    expect(initiateUrl).not.toBeNull();
    const redirectUri = initiateUrl!.searchParams.get("redirect_uri");
    expect(redirectUri).toBe(`${BASE}/auth/callback`);
    expect(new URL(page.url()).pathname).toBe("/student/dashboard");
  });
});
