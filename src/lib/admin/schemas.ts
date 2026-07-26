import { z } from "zod";

export const courseInputSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase-with-dashes"),
  title_ja: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200),
  subtitle_ja: z.string().max(300).nullable().optional(),
  subtitle_en: z.string().max(300).nullable().optional(),
  description_ja: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  banner_url: z.string().url().nullable().optional(),
  price_jpy: z.number().int().min(0).max(10_000_000),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});
export type CourseInput = z.infer<typeof courseInputSchema>;

export const moduleInputSchema = z.object({
  course_id: z.string().uuid(),
  stage_id: z.string().uuid().nullable().optional(),
  slug: z.string().min(1).max(80),
  title_ja: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200),
  description_ja: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  release_type: z.enum(["immediate", "date", "after_previous"]).default("immediate"),
  release_at: z.string().datetime().nullable().optional(),
  is_locked: z.boolean().default(false),
});
export type ModuleInput = z.infer<typeof moduleInputSchema>;

export const lessonInputSchema = z.object({
  module_id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  title_ja: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200),
  description_ja: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  lesson_type: z.enum(["video", "reading", "quiz", "assignment"]).default("video"),
  duration_seconds: z.number().int().min(0).max(60 * 60 * 24).nullable().optional(),
  is_preview: z.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
  stream_video_uid: z.string().nullable().optional(),
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
