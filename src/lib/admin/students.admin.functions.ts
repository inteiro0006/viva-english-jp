import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";
import { grantEnrollmentSchema } from "@/lib/admin/schemas";

type EnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  expires_at: string | null;
  enrolled_at: string;
  courses: { title_ja: string; title_en: string } | null;
};

export const listStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().optional(),
        filter: z.enum(["all", "enrolled", "not_enrolled"]).default("all"),
        page: z.number().int().min(0).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const pageSize = 25;
    let q = context.supabase
      .from("profiles")
      .select("id, full_name, preferred_language, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    if (data.search) q = q.ilike("full_name", `%${data.search}%`);
    const { data: profiles, error, count } = await q;
    if (error) throw new Error(error.message);
    const rows = profiles ?? [];
    const ids = rows.map((r) => r.id);
    let enrollmentsByUser = new Map<string, EnrollmentRow[]>();
    const emailsById = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: enrollments } = await context.supabase
        .from("enrollments")
        .select("id, user_id, course_id, status, expires_at, enrolled_at, courses(title_ja, title_en)")
        .in("user_id", ids);
      for (const e of (enrollments ?? []) as EnrollmentRow[]) {
        const list = enrollmentsByUser.get(e.user_id) ?? [];
        list.push(e);
        enrollmentsByUser.set(e.user_id, list);
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of usersData?.users ?? []) {
        if (ids.includes(u.id)) emailsById.set(u.id, u.email ?? null);
      }
    }
    let joined = rows.map((r) => ({
      ...r,
      email: emailsById.get(r.id) ?? null,
      enrollments: enrollmentsByUser.get(r.id) ?? [],
    }));
    if (data.filter === "enrolled") {
      joined = joined.filter((r) => r.enrollments.some((e) => e.status === "active"));
    } else if (data.filter === "not_enrolled") {
      joined = joined.filter((r) => !r.enrollments.some((e) => e.status === "active"));
    }
    return { rows: joined, total: count ?? 0, pageSize };
  });

export type AllUsersRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  preferred_language: "ja" | "en" | null;
  role: "admin" | "student";
  created_at: string;
  last_sign_in_at: string | null;
};

export const listAllUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().optional(),
        role: z.enum(["all", "admin", "student"]).default("all"),
        page: z.number().int().min(0).default(0),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const pageSize = 25;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({
      page: data.page + 1,
      perPage: pageSize,
    });
    if (error) throw new Error(error.message);
    const users = usersData?.users ?? [];
    const ids = users.map((u) => u.id);

    const [profilesRes, rolesRes] = await Promise.all([
      ids.length
        ? context.supabase
            .from("profiles")
            .select("id, full_name, preferred_language")
            .in("id", ids)
        : Promise.resolve({ data: [], error: null } as const),
      ids.length
        ? context.supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    const profiles = new Map<string, { full_name: string; preferred_language: "ja" | "en" }>();
    for (const p of profilesRes.data ?? []) {
      profiles.set(p.id, {
        full_name: p.full_name,
        preferred_language: p.preferred_language as "ja" | "en",
      });
    }
    const roles = new Map<string, "admin" | "student">();
    for (const r of rolesRes.data ?? []) {
      const current = roles.get(r.user_id);
      if (r.role === "admin" || !current) roles.set(r.user_id, r.role as "admin" | "student");
    }

    let rows: AllUsersRow[] = users.map((u) => {
      const prof = profiles.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        full_name: prof?.full_name ?? null,
        preferred_language: prof?.preferred_language ?? null,
        role: roles.get(u.id) ?? "student",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      };
    });

    if (data.search) {
      const q = data.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.full_name ?? "").toLowerCase().includes(q),
      );
    }
    if (data.role !== "all") {
      rows = rows.filter((r) => r.role === data.role);
    }

    return { rows, total: usersData?.total ?? rows.length, pageSize };
  });


export const getStudentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", data.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const { data: enrollments } = await context.supabase
      .from("enrollments")
      .select("*, courses(id, title_ja, title_en, slug)")
      .eq("user_id", data.userId)
      .order("enrolled_at", { ascending: false });
    const { data: orders } = await context.supabase
      .from("orders")
      .select("id, status, amount, currency, created_at, paid_at, course_id")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false });
    return { profile, enrollments: enrollments ?? [], orders: orders ?? [] };
  });

export const grantEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => grantEnrollmentSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: inserted, error } = await context.supabase
      .from("enrollments")
      .insert({
        user_id: data.user_id,
        course_id: data.course_id,
        expires_at: data.expires_at ?? null,
        status: "active",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "enrollment.grant",
      entityType: "enrollment",
      entityId: inserted.id,
      newValues: { ...data },
    });
    return inserted;
  });

export const revokeEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ enrollment_id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("enrollments")
      .select("*")
      .eq("id", data.enrollment_id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("enrollments")
      .update({ status: "revoked" })
      .eq("id", data.enrollment_id);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "enrollment.revoke",
      entityType: "enrollment",
      entityId: data.enrollment_id,
      oldValues: prev,
      newValues: { status: "revoked", reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const setEnrollmentExpiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enrollment_id: z.string().uuid(),
        expires_at: z.string().datetime().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("enrollments")
      .select("expires_at")
      .eq("id", data.enrollment_id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("enrollments")
      .update({ expires_at: data.expires_at })
      .eq("id", data.enrollment_id);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "enrollment.set_expiry",
      entityType: "enrollment",
      entityId: data.enrollment_id,
      oldValues: prev,
      newValues: { expires_at: data.expires_at },
    });
    return { ok: true };
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (uErr) throw new Error(uErr.message);
    const email = userRes?.user?.email;
    if (!email) throw new Error("User has no email");
    const siteUrl = process.env.SITE_URL ?? process.env.VITE_SITE_URL;
    const redirectTo = siteUrl ? `${siteUrl}/reset-password` : undefined;
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, {
      action: "user.password_reset_sent",
      entityType: "user",
      entityId: data.userId,
      newValues: { email },
    });
    return { ok: true, email };
  });
