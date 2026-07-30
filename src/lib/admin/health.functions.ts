import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin/require-admin";
import type { HealthReport } from "@/lib/admin/health.server";

export type { HealthReport, HealthCheck, HealthStatus } from "@/lib/admin/health.server";

export const getSchemaHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthReport> => {
    await assertAdmin(context);
    const { runSchemaHealthCheck } = await import("@/lib/admin/health.server");
    return runSchemaHealthCheck(context.supabase);
  });
