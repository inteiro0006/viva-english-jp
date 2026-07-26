import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, ShieldAlert, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { verifyCertificatePublic } from "@/lib/certificates/certificates.functions";

export const Route = createFileRoute("/certificate/$verificationCode")({
  head: ({ params }) => ({
    meta: [
      { title: `Certificate ${params.verificationCode} — Eigo Michi` },
      {
        name: "description",
        content:
          "Verify the authenticity of an Eigo Michi course completion certificate.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { t, i18n } = useTranslation();
  const { verificationCode } = Route.useParams();
  const q = useQuery({
    queryKey: ["cert-verify", verificationCode],
    queryFn: () =>
      verifyCertificatePublic({ data: { code: verificationCode } }),
    staleTime: 60_000,
  });

  const isJa = i18n.language.startsWith("ja");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link to="/" className="text-2xl font-bold text-primary">
          Eigo Michi
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("certificate.verify.pageTitle")}
        </p>
      </div>

      {q.isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("certificate.verify.loading")}
          </CardContent>
        </Card>
      )}

      {q.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <p className="font-semibold">{t("certificate.verify.error")}</p>
          </CardContent>
        </Card>
      )}

      {q.data && (
        <Card
          className={
            q.data.valid
              ? "border-primary/40 bg-primary/5"
              : "border-destructive/40 bg-destructive/5"
          }
        >
          <CardContent className="flex flex-col gap-6 py-8">
            <div className="flex items-center gap-3">
              {q.data.valid ? (
                <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden />
              ) : (
                <XCircle className="h-10 w-10 text-destructive" aria-hidden />
              )}
              <div>
                <h1 className="text-xl font-semibold">
                  {q.data.valid
                    ? t("certificate.verify.valid")
                    : q.data.status === "revoked"
                      ? t("certificate.verify.revoked")
                      : t("certificate.verify.notFound")}
                </h1>
                <Badge
                  variant={q.data.valid ? "default" : "destructive"}
                  className="mt-1"
                >
                  {q.data.status}
                </Badge>
              </div>
            </div>

            {q.data.status !== "not_found" && (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Field
                  label={t("certificate.verify.field.name")}
                  value={q.data.studentNameMasked || "—"}
                />
                <Field
                  label={t("certificate.verify.field.course")}
                  value={
                    (isJa ? q.data.courseTitleJa : q.data.courseTitleEn) || "—"
                  }
                />
                <Field
                  label={t("certificate.verify.field.number")}
                  value={q.data.certificateNumber || "—"}
                />
                <Field
                  label={t("certificate.verify.field.issued")}
                  value={
                    q.data.issuedAt
                      ? new Date(q.data.issuedAt).toLocaleDateString(
                          isJa ? "ja-JP" : "en-US",
                        )
                      : "—"
                  }
                />
                {q.data.revokedAt && (
                  <Field
                    label={t("certificate.verify.field.revoked")}
                    value={new Date(q.data.revokedAt).toLocaleDateString(
                      isJa ? "ja-JP" : "en-US",
                    )}
                  />
                )}
              </dl>
            )}

            <p className="text-xs text-muted-foreground">
              {t("certificate.verify.privacyNote")}
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
