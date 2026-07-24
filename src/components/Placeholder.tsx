import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PlaceholderProps {
  title: string;
  description?: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  const { t } = useTranslation();
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 py-6">
          <Sparkles className="mt-0.5 size-5 text-[color:var(--brand)]" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {t("placeholder.note")}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
