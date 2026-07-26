import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const communicationPrefsSchema = z.object({
  product_updates: z.boolean(),
  learning_reminders: z.boolean(),
  marketing: z.boolean(),
});

export type CommunicationPreferences = z.infer<typeof communicationPrefsSchema>;

export const getProfileOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const [profileRes, enrollmentsRes, ordersRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, preferred_language, communication_preferences, marketing_consent, created_at",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select(
          "id, status, enrolled_at, expires_at, courses:course_id (id, slug, title_ja, title_en)",
        )
        .eq("user_id", userId)
        .order("enrolled_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id, status, amount, currency, paid_at, created_at, course_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (enrollmentsRes.error) throw new Error(enrollmentsRes.error.message);
    if (ordersRes.error) throw new Error(ordersRes.error.message);

    const email =
      (claims as { email?: string } | null)?.email ??
      (claims as { user_metadata?: { email?: string } } | null)?.user_metadata
        ?.email ??
      null;

    return {
      profile: profileRes.data,
      email,
      enrollments: enrollmentsRes.data ?? [],
      orders: ordersRes.data ?? [],
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        preferred_language: z.enum(["ja", "en"]),
        avatar_url: z.string().max(500).nullable().optional(),
        communication_preferences: communicationPrefsSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = {
      full_name: data.full_name,
      preferred_language: data.preferred_language,
      communication_preferences: data.communication_preferences,
      marketing_consent: data.communication_preferences.marketing,
    };
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;

    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId)
      .select(
        "id, full_name, avatar_url, preferred_language, communication_preferences, marketing_consent",
      )
      .maybeSingle();
    if (error) throw new Error(error.message);
    return updated;
  });

export const signAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    // Only allow signing paths inside the caller's own folder.
    const firstSegment = data.path.split("/")[0];
    if (firstSegment !== context.userId) {
      throw new Error("forbidden");
    }
    const { data: signed, error } = await context.supabase.storage
      .from("avatars")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });
