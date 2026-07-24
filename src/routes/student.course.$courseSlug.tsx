import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/student/course/$courseSlug")({
  component: StudentCoursePage,
});

function StudentCoursePage() {
  const { courseSlug } = Route.useParams();
  const { t } = useTranslation();
  return (
    <Placeholder
      title={`${t("student.myCourse")} — ${courseSlug}`}
      description={t("course.subtitle")}
    />
  );
}
