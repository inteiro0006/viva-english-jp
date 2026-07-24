import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/student/lesson/$lessonId")({
  component: StudentLessonPage,
});

function StudentLessonPage() {
  const { lessonId } = Route.useParams();
  const { t } = useTranslation();
  return (
    <Placeholder
      title={`${t("student.lessons")} #${lessonId}`}
      description={t("placeholder.note")}
    />
  );
}
