import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/student")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    return { userId: data.user.id };
  },
  component: () => (
    <StudentLayout>
      <Outlet />
    </StudentLayout>
  ),
});
