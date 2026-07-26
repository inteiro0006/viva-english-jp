import { z } from "zod";

export const courseInputSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase-with-dashes"),
  title_ja: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200),
  description_ja: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  price_jpy: z.number().int().min(0).max(10_000_000),
  access_type: z.enum(["lifetime", "limited"]).default("lifetime"),
  access_duration_days: z.number().int().min(1).max(3650).nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});
export type CourseInput = z.infer<typeof courseInputSchema>;

export const moduleInputSchema = z.object({
  course_id: z.string().uuid(),
  stage_id: z.string().uuid().nullable().optional(),
  title_ja: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200),
  description_ja: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  release_type: z.enum(["immediate", "date", "after_previous"]).default("immediate"),
  release_at: z.string().datetime().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});
export type ModuleInput = z.infer<typeof moduleInputSchema>;

export const lessonInputSchema = z.object({
  module_id: z.string().uuid(),
  title_ja: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200),
  description_ja: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  lesson_type: z.enum(["video", "text", "quiz", "file"]).default("video"),
  duration_seconds: z.number().int().min(0).max(60 * 60 * 24).default(0),
  is_preview: z.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  cloudflare_video_uid: z.string().nullable().optional(),
});
export type LessonInput = z.infer<typeof lessonInputSchema>;

export const grantEnrollmentSchema = z.object({
  user_id: z.string().uuid(),
  course_id: z.string().uuid(),
  expires_at: z.string().datetime().nullable().optional(),
  note: z.string().max(500).optional(),
});

export const settingUpdateSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.unknown(),
});
