import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "ログイン — Eigo Michi" },
      { name: "description", content: "アカウントにログインします。" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
        <header className="text-center">
          <h1 className="text-3xl font-bold">{t("auth.loginTitle")}</h1>
        </header>
        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => e.preventDefault()}
              aria-label={t("auth.loginTitle")}
            >
              <div className="grid gap-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" disabled>
                {t("auth.submit")}
              </Button>
            </form>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <Link to="/forgot-password" className="hover:text-foreground">
                {t("auth.forgotPassword")}
              </Link>
              <span>
                {t("auth.noAccount")}{" "}
                <Link to="/register" className="text-[color:var(--brand)] hover:underline">
                  {t("nav.register")}
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </PublicLayout>
  );
}
