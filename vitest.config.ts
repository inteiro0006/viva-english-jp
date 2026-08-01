import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests only — Playwright specs under e2e/ run via `bun run test:e2e`.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
