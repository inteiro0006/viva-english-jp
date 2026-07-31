import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith("ja") ? "ja" : "en";
  const next = current === "ja" ? "en" : "ja";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      aria-label={t("language.label")}
      onClick={() => void i18n.changeLanguage(next)}
    >
      <Globe className="size-4" aria-hidden />
      <span className="font-medium">{next === "ja" ? "日本語" : "English"}</span>
    </Button>
  );
}
