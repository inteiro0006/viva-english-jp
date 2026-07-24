import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "パスワード再設定 — Eigo Michi" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
        <header className="text-center">
          <h1 className="text-3xl font-bold">{t("auth.resetTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.resetSubtitle")}
          </p>
        </header>
        <Card>
          <CardContent className="py-6">
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="grid gap-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" autoComplete="email" required />
              </div>
              <Button type="submit" disabled>
                {t("auth.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </PublicLayout>
  );
}
