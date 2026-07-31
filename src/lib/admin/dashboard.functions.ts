import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin/require-admin";

export type AdminDashboardStats = {
  totalStudents: number;
  activeEnrollments: number;
  paidOrders: number;
  revenueJpy: number;
  averageCompletion: number;
  processingVideos: number;
  openSupport: number;
  topLessons: Array<{ id: string; title_ja: string; title_en: string; watches: number }>;
  recentEnrollments: Array<{ date: string; count: number }>;
};

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDashboardStats> => {
    await assertAdmin(context);
    const { supabase } = context;

    const [
      studentsRes,
      enrollmentsRes,
      ordersPaidRes,
      revenueRes,
      progressRes,
      videosRes,
      supportRes,
      topLessonsRes,
      recentEnrollRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "paid"),
      supabase.from("orders").select("amount").eq("status", "paid"),
      supabase.from("lesson_progress").select("progress_percentage"),
      supabase
        .from("stream_videos")
        .select("*", { count: "exact", head: true })
        .in("status", ["pendingupload", "downloading", "queued", "inprogress"]),
      supabase
        .from("support_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("lesson_progress")
        .select("lesson_id, lessons(id, title_ja, title_en)")
        .limit(500),
      supabase
        .from("enrollments")
        .select("enrolled_at")
        .gte("enrolled_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
        .order("enrolled_at", { ascending: true }),
    ]);

    const revenueJpy = (revenueRes.data ?? []).reduce(
      (sum, r: { amount: number | null }) => sum + (r.amount ?? 0),
      0,
    );
    const progressRows = (progressRes.data ?? []) as Array<{ progress_percentage: number | null }>;
    const averageCompletion = progressRows.length
      ? progressRows.reduce((s, r) => s + (r.progress_percentage ?? 0), 0) / progressRows.length
      : 0;

    // Aggregate top lessons by watch count from lesson_progress.
    const counts = new Map<string, { title_ja: string; title_en: string; watches: number }>();
    for (const row of (topLessonsRes.data ?? []) as Array<{
      lesson_id: string;
      lessons: { id: string; title_ja: string; title_en: string } | null;
    }>) {
      if (!row.lessons) continue;
      const existing = counts.get(row.lesson_id) ?? {
        title_ja: row.lessons.title_ja,
        title_en: row.lessons.title_en,
        watches: 0,
      };
      existing.watches += 1;
      counts.set(row.lesson_id, existing);
    }
    const topLessons = Array.from(counts.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.watches - a.watches)
      .slice(0, 5);

    // Group enrollments by day.
    const byDay = new Map<string, number>();
    for (const row of (recentEnrollRes.data ?? []) as Array<{ enrolled_at: string }>) {
      const d = new Date(row.enrolled_at).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const recentEnrollments = Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalStudents: studentsRes.count ?? 0,
      activeEnrollments: enrollmentsRes.count ?? 0,
      paidOrders: ordersPaidRes.count ?? 0,
      revenueJpy,
      averageCompletion: Math.round(averageCompletion * 10) / 10,
      processingVideos: videosRes.count ?? 0,
      openSupport: supportRes.count ?? 0,
      topLessons,
      recentEnrollments,
    };
  });
