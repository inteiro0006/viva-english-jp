import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SUPPORT_CATEGORIES = [
  "payment",
  "access",
  "content",
  "video",
  "account",
  "other",
] as const;

export const createSupportRequestSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
  category: z.enum(SUPPORT_CATEGORIES),
  attachment_url: z.string().max(500).nullable().optional(),
});

export const listMySupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_requests")
      .select(
        "id, subject, message, category, status, attachment_url, response, responded_at, created_at, updated_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSupportRequestSchema.parse(d))
  .handler(async ({ context, data }) => {
    // If an attachment path was provided, enforce that it lives in the caller's folder.
    if (data.attachment_url) {
      const first = data.attachment_url.split("/")[0];
      if (first !== context.userId) throw new Error("forbidden");
    }
    const { data: inserted, error } = await context.supabase
      .from("support_requests")
      .insert({
        user_id: context.userId,
        subject: data.subject,
        message: data.message,
        category: data.category,
        attachment_url: data.attachment_url ?? null,
        status: "open",
      })
      .select("id, subject, category, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const listFaq = createServerFn({ method: "GET" }).handler(async () => {
  // Public FAQ read — RLS already allows anon SELECT on published rows.
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  const supabase = createClient(url, key, {
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
  const { data, error } = await supabase
    .from("faq_items")
    .select("id, question_ja, question_en, answer_ja, answer_en, category, position")
    .eq("published", true)
    .order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
});
