import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StudentLayout } from "@/components/layout/StudentLayout";

export const Route = createFileRoute("/student")({
  component: () => (
    <StudentLayout>
      <Outlet />
    </StudentLayout>
  ),
});
