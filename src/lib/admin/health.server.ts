import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type HealthStatus = "ok" | "warn" | "error";

export type HealthCheck = {
  id: string;
  group: "table" | "function" | "relationship";
  label: string;
  status: HealthStatus;
  /** Friendly, non-technical explanation shown in the UI. */
  message: string;
  /** Raw database detail, only surfaced to admins for debugging. */
  detail?: string;
};

export type HealthReport = {
  status: HealthStatus;
  checkedAt: string;
  okCount: number;
  warnCount: number;
  errorCount: number;
  checks: HealthCheck[];
};

/**
 * Columns the application code relies on. Kept intentionally narrow: only the
 * fields that would break a screen if they disappeared from the schema.
 */
const EXPECTED_TABLES: Array<{ table: keyof Database["public"]["Tables"]; columns: string[] }> = [
  { table: "profiles", columns: ["id", "full_name", "preferred_language"] },
  { table: "user_roles", columns: ["user_id", "role"] },
  { table: "courses", columns: ["id", "slug", "title_ja", "title_en", "status", "price_jpy"] },
  { table: "course_stages", columns: ["id", "course_id", "position", "status"] },
  { table: "modules", columns: ["id", "course_id", "stage_id", "position", "release_type", "status"] },
  {
    table: "lessons",
    columns: ["id", "module_id", "position", "lesson_type", "cloudflare_video_uid", "status"],
  },
  { table: "lesson_progress", columns: ["user_id", "lesson_id", "progress_percentage", "completed"] },
  { table: "enrollments", columns: ["user_id", "course_id", "status", "expires_at"] },
  { table: "orders", columns: ["user_id", "course_id", "status", "amount", "currency"] },
  { table: "certificates", columns: ["user_id", "course_id", "verification_code", "revoked_at"] },
  { table: "stream_videos", columns: ["cloudflare_uid", "status", "ready_to_stream"] },
  { table: "support_requests", columns: ["user_id", "status", "category"] },
  {
    table: "admin_audit_logs",
    columns: ["admin_id", "action", "entity_type", "entity_id", "changed_fields", "summary"],
  },
];

/**
 * Embedded selects the app performs. These depend on foreign keys existing in
 * PostgREST's schema cache — exactly the class of failure this check exists for.
 */
const EXPECTED_RELATIONSHIPS: Array<{
  id: string;
  label: string;
  table: keyof Database["public"]["Tables"];
  select: string;
}> = [
  { id: "modules->courses", label: "Modules → Course", table: "modules", select: "id, courses(id)" },
  { id: "lessons->modules", label: "Lessons → Module", table: "lessons", select: "id, modules(id)" },
  {
    id: "lesson_progress->lessons",
    label: "Progress → Lesson",
    table: "lesson_progress",
    select: "lesson_id, lessons(id)",
  },
  {
    id: "enrollments->courses",
    label: "Enrollments → Course",
    table: "enrollments",
    select: "id, courses(id)",
  },
  {
    id: "certificates->courses",
    label: "Certificates → Course",
    table: "certificates",
    select: "id, courses(id)",
  },
];

const EXPECTED_FUNCTIONS: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: "has_role", args: { _user_id: NIL_UUID(), _role: "admin" } },
  { name: "is_admin", args: { _uid: NIL_UUID() } },
  { name: "has_active_enrollment", args: { _uid: NIL_UUID(), _course_id: NIL_UUID() } },
  { name: "is_certificate_eligible", args: { _uid: NIL_UUID(), _course_id: NIL_UUID() } },
  { name: "get_course_progress", args: { _uid: NIL_UUID(), _course_id: NIL_UUID() } },
  { name: "get_next_lesson", args: { _uid: NIL_UUID(), _course_id: NIL_UUID() } },
  { name: "verify_certificate", args: { _code: "__healthcheck__" } },
];

function NIL_UUID() {
  return "00000000-0000-0000-0000-000000000000";
}

type PgError = { message: string; code?: string | null; details?: string | null };

/** Turn a raw PostgREST error into something an admin can act on. */
function friendly(error: PgError, subject: string): { status: HealthStatus; message: string } {
  const code = error.code ?? "";
  const msg = error.message ?? "";

  if (code === "PGRST200" || /Could not find a relationship/i.test(msg)) {
    return {
      status: "error",
      message: `${subject}: the expected link between these tables is missing. A database migration probably did not run, or the foreign key was removed.`,
    };
  }
  if (code === "PGRST204" || code === "42703" || /column .* does not exist/i.test(msg)) {
    return {
      status: "error",
      message: `${subject}: an expected field is missing from this table. The app and the database are out of sync.`,
    };
  }
  if (code === "PGRST202" || /Could not find the function/i.test(msg)) {
    return {
      status: "error",
      message: `${subject}: this database routine is missing, so features that depend on it will fail.`,
    };
  }
  if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return {
      status: "error",
      message: `${subject}: the table does not exist in the database.`,
    };
  }
  if (code === "42501" || /permission denied/i.test(msg)) {
    return {
      status: "error",
      message: `${subject}: access is denied. The table exists but permissions were not granted for the app.`,
    };
  }
  // Row-level restrictions and empty results are healthy: the shape is valid.
  return {
    status: "warn",
    message: `${subject}: responded with an unexpected condition. Data access still works, but this is worth reviewing.`,
  };
}

async function probe(
  supabase: SupabaseClient<Database>,
  table: string,
  select: string,
): Promise<PgError | null> {
  const { error } = await supabase
    .from(table as never)
    .select(select)
    .limit(1);
  return error ? { message: error.message, code: error.code, details: error.details } : null;
}

export async function runSchemaHealthCheck(
  supabase: SupabaseClient<Database>,
): Promise<HealthReport> {
  const checks: HealthCheck[] = [];

  const tableChecks = await Promise.all(
    EXPECTED_TABLES.map(async ({ table, columns }) => {
      const error = await probe(supabase, table as string, columns.join(", "));
      const check: HealthCheck = error
        ? {
            id: `table:${String(table)}`,
            group: "table",
            label: String(table),
            ...friendly(error, `Table "${String(table)}"`),
            detail: error.message,
          }
        : {
            id: `table:${String(table)}`,
            group: "table",
            label: String(table),
            status: "ok",
            message: `All ${columns.length} expected fields are present.`,
          };
      return check;
    }),
  );
  checks.push(...tableChecks);

  const relChecks = await Promise.all(
    EXPECTED_RELATIONSHIPS.map(async ({ id, label, table, select }) => {
      const error = await probe(supabase, table as string, select);
      const check: HealthCheck = error
        ? {
            id: `rel:${id}`,
            group: "relationship",
            label,
            ...friendly(error, `Relationship "${label}"`),
            detail: error.message,
          }
        : {
            id: `rel:${id}`,
            group: "relationship",
            label,
            status: "ok",
            message: "Linked correctly.",
          };
      return check;
    }),
  );
  checks.push(...relChecks);

  const fnChecks = await Promise.all(
    EXPECTED_FUNCTIONS.map(async ({ name, args }) => {
      const { error } = await supabase.rpc(name as never, args as never);
      const check: HealthCheck = error
        ? {
            id: `fn:${name}`,
            group: "function",
            label: `${name}()`,
            ...friendly(
              { message: error.message, code: error.code, details: error.details },
              `Routine "${name}()"`,
            ),
            detail: error.message,
          }
        : {
            id: `fn:${name}`,
            group: "function",
            label: `${name}()`,
            status: "ok",
            message: "Available and callable.",
          };
      return check;
    }),
  );
  checks.push(...fnChecks);

  const errorCount = checks.filter((c) => c.status === "error").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const okCount = checks.filter((c) => c.status === "ok").length;

  return {
    status: errorCount > 0 ? "error" : warnCount > 0 ? "warn" : "ok",
    checkedAt: new Date().toISOString(),
    okCount,
    warnCount,
    errorCount,
    checks,
  };
}
