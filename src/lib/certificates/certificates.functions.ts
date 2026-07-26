import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAction } from "@/lib/admin/require-admin";

// ---------------- helpers ----------------

function randomCode(len: number): string {
  // Base32 (Crockford-ish, unambiguous glyphs)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function makeCertificateNumber(): string {
  const y = new Date().getUTCFullYear();
  return `EIGO-${y}-${randomCode(8)}`;
}

function makeVerificationCode(): string {
  return `${randomCode(4)}-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;
}

function buildOrigin(): string {
  const raw =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    "";
  if (raw) return raw.replace(/\/$/, "");
  const supa = process.env.SUPABASE_URL || "";
  // Best-effort: derive from published project url pattern
  const m = supa.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
  if (m) return `https://${m[1]}.lovable.app`;
  return "";
}

// ---------------- student: status ----------------

export const getCertificateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const [certRes, eligRes, progRes, courseRes] = await Promise.all([
      supabase
        .from("certificates")
        .select(
          "id, certificate_number, verification_code, issued_at, pdf_path, language, revoked_at",
        )
        .eq("user_id", userId)
        .eq("course_id", data.courseId)
        .is("revoked_at", null)
        .maybeSingle(),
      supabase.rpc("is_certificate_eligible", {
        _uid: userId,
        _course_id: data.courseId,
      }),
      supabase.rpc("get_course_progress", {
        _uid: userId,
        _course_id: data.courseId,
      }),
      supabase
        .from("courses")
        .select("id, title_ja, title_en")
        .eq("id", data.courseId)
        .maybeSingle(),
    ]);

    if (certRes.error) throw new Error(certRes.error.message);
    if (eligRes.error) throw new Error(eligRes.error.message);
    if (courseRes.error) throw new Error(courseRes.error.message);

    const progress = progRes.data?.[0] ?? null;

    return {
      eligible: eligRes.data === true,
      certificate: certRes.data,
      progress: progress
        ? {
            totalLessons: progress.total_lessons ?? 0,
            completedLessons: progress.completed_lessons ?? 0,
            percentage: Number(progress.percentage ?? 0),
          }
        : { totalLessons: 0, completedLessons: 0, percentage: 0 },
      course: courseRes.data,
    };
  });

// ---------------- student: issue ----------------

export const issueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        courseId: z.string().uuid(),
        language: z.enum(["ja", "en"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // 1. Server-side eligibility check
    const { data: eligible, error: eErr } = await supabase.rpc(
      "is_certificate_eligible",
      { _uid: userId, _course_id: data.courseId },
    );
    if (eErr) throw new Error(eErr.message);
    if (!eligible) throw new Error("not_eligible");

    // 2. Return existing active certificate if present
    const existing = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", data.courseId)
      .is("revoked_at", null)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return { certificate: existing.data, created: false };

    // 3. Gather profile + course to snapshot (backend-owned; not from client)
    const [profileRes, courseRes, lessonsRes, settingsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, preferred_language")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("courses")
        .select("id, title_ja, title_en")
        .eq("id", data.courseId)
        .maybeSingle(),
      supabase
        .from("lessons")
        .select("duration_seconds, module_id, modules!inner(course_id)")
        .eq("modules.course_id", data.courseId)
        .eq("status", "published"),
      supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", [
          "platform_name",
          "institutional_ja",
          "institutional_en",
          "certificate_signatory",
        ]),
    ]);
    if (profileRes.error) throw new Error(profileRes.error.message);
    if (courseRes.error) throw new Error(courseRes.error.message);
    if (lessonsRes.error) throw new Error(lessonsRes.error.message);
    if (!profileRes.data?.full_name) throw new Error("profile_incomplete");
    if (!courseRes.data) throw new Error("course_not_found");

    const totalSeconds = (lessonsRes.data ?? []).reduce(
      (acc: number, l: { duration_seconds: number | null }) =>
        acc + (l.duration_seconds ?? 0),
      0,
    );
    const totalHours = totalSeconds > 0 ? Math.round(totalSeconds / 3600) : null;


    const language: "ja" | "en" =
      data.language ??
      (profileRes.data.preferred_language === "en" ? "en" : "ja");

    const courseTitle =
      language === "ja"
        ? courseRes.data.title_ja || courseRes.data.title_en
        : courseRes.data.title_en || courseRes.data.title_ja;

    const settingsMap = new Map<string, unknown>(
      (settingsRes.data ?? []).map((r) => [r.key, r.value]),
    );
    const institutionName =
      (settingsMap.get("platform_name") as string) || "Eigo Academy";
    const institutionTagline =
      ((settingsMap.get(
        language === "ja" ? "institutional_ja" : "institutional_en",
      ) as string) || "");
    const signatoryName =
      (settingsMap.get("certificate_signatory") as string | null) || null;

    // 4. Insert certificate row (admin client to bypass client-side INSERT RLS)
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    let inserted: {
      id: string;
      certificate_number: string;
      verification_code: string;
      issued_at: string;
      language: string;
      pdf_path: string | null;
      revoked_at: string | null;
    } | null = null;

    // Retry a couple of times if we hit the unique index (extremely unlikely)
    for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
      const number = makeCertificateNumber();
      const code = makeVerificationCode();
      const { data: row, error } = await supabaseAdmin
        .from("certificates")
        .insert({
          user_id: userId,
          course_id: data.courseId,
          certificate_number: number,
          verification_code: code,
          language,
          student_name_snapshot: profileRes.data.full_name,
          course_title_snapshot: courseTitle ?? "",
          hours_snapshot: totalHours,
        })
        .select(
          "id, certificate_number, verification_code, issued_at, language, pdf_path, revoked_at",
        )
        .single();
      if (!error) {
        inserted = row;
        break;
      }
      // 23505 unique violation → retry once
      if (!error.message?.match(/duplicate|unique/i)) throw new Error(error.message);
    }
    if (!inserted) throw new Error("could_not_issue");

    // 5. Render PDF and upload
    const { renderCertificatePdf } = await import("./pdf.server");
    const origin = buildOrigin();
    const verificationUrl = origin
      ? `${origin}/certificate/${inserted.verification_code}`
      : `/certificate/${inserted.verification_code}`;

    const pdfBytes = await renderCertificatePdf({
      studentName: profileRes.data.full_name,
      courseTitle: courseTitle ?? "",
      issuedAt: new Date(inserted.issued_at),
      hours:
        typeof courseRes.data.hours === "number" ? courseRes.data.hours : null,
      certificateNumber: inserted.certificate_number,
      verificationCode: inserted.verification_code,
      verificationUrl,
      language,
      institutionName,
      institutionTagline,
      signatoryName,
    });

    const pdfPath = `${userId}/${inserted.id}.pdf`;
    const up = await supabaseAdmin.storage
      .from("certificates")
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (up.error) throw new Error(up.error.message);

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("certificates")
      .update({ pdf_path: pdfPath })
      .eq("id", inserted.id)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    return { certificate: updated, created: true };
  });

// ---------------- student: signed download URL ----------------

export const getCertificateDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ certificateId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cert, error } = await supabase
      .from("certificates")
      .select("id, user_id, pdf_path, revoked_at")
      .eq("id", data.certificateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cert) throw new Error("not_found");
    if (cert.user_id !== userId) throw new Error("forbidden");
    if (cert.revoked_at) throw new Error("revoked");
    if (!cert.pdf_path) throw new Error("pdf_missing");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("certificates")
      .createSignedUrl(cert.pdf_path, 60 * 5);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

// ---------------- admin: list ----------------

export const adminListCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        courseId: z.string().uuid().optional(),
        includeRevoked: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("certificates")
      .select(
        "id, user_id, course_id, certificate_number, verification_code, issued_at, revoked_at, revoke_reason, language, student_name_snapshot, course_title_snapshot",
      )
      .order("issued_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (!data.includeRevoked) q = q.is("revoked_at", null);
    if (data.courseId) q = q.eq("course_id", data.courseId);
    if (data.search)
      q = q.or(
        `certificate_number.ilike.%${data.search}%,verification_code.ilike.%${data.search}%,student_name_snapshot.ilike.%${data.search}%`,
      );
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------------- admin: revoke ----------------

export const adminRevokeCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        certificateId: z.string().uuid(),
        reason: z.string().trim().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase
      .from("certificates")
      .select("id, revoked_at, revoke_reason")
      .eq("id", data.certificateId)
      .maybeSingle();
    if (!prev) throw new Error("not_found");
    if (prev.revoked_at) throw new Error("already_revoked");

    const { data: updated, error } = await context.supabase
      .from("certificates")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: context.userId,
        revoke_reason: data.reason,
      })
      .eq("id", data.certificateId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await logAdminAction(context.supabase, {
      action: "certificate.revoke",
      entityType: "certificate",
      entityId: data.certificateId,
      oldValues: prev,
      newValues: { revoked_at: updated.revoked_at, reason: data.reason },
    });
    return updated;
  });

// ---------------- public: verify ----------------

export const verifyCertificatePublic = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(4)
          .max(64)
          .regex(/^[A-Z0-9-]+$/i, "invalid_code"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supa = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: rows, error } = await supa.rpc("verify_certificate", {
      _code: data.code.toUpperCase(),
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row || !row.certificate_number)
      return { valid: false, status: "not_found" as const };
    return {
      valid: row.valid,
      status: row.status as "valid" | "revoked" | "not_found",
      certificateNumber: row.certificate_number,
      studentNameMasked: row.student_name_masked,
      courseTitleJa: row.course_title_ja,
      courseTitleEn: row.course_title_en,
      issuedAt: row.issued_at,
      revokedAt: row.revoked_at,
    };
  });
