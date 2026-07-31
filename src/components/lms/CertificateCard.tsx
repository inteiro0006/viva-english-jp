import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Award, Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getCertificateStatus,
  issueCertificate,
  getCertificateDownloadUrl,
} from "@/lib/certificates/certificates.functions";

interface Props {
  courseId: string;
}

export function CertificateCard({ courseId }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const getStatus = useServerFn(getCertificateStatus);
  const issueFn = useServerFn(issueCertificate);
  const downloadFn = useServerFn(getCertificateDownloadUrl);

  const statusQ = useQuery({
    queryKey: ["certificate-status", courseId],
    queryFn: () => getStatus({ data: { courseId } }),
    staleTime: 30_000,
  });

  const issueMut = useMutation({
    mutationFn: (lang: "ja" | "en") => issueFn({ data: { courseId, language: lang } }),
    onSuccess: () => {
      toast.success(t("certificate.issuedToast"));
      qc.invalidateQueries({ queryKey: ["certificate-status", courseId] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg === "not_eligible"
          ? t("certificate.errors.notEligible")
          : msg === "profile_incomplete"
            ? t("certificate.errors.profileIncomplete")
            : t("certificate.errors.generic"),
      );
    },
  });

  const downloadMut = useMutation({
    mutationFn: (certificateId: string) => downloadFn({ data: { certificateId } }),
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener");
    },
    onError: () => toast.error(t("certificate.errors.download")),
  });

  if (statusQ.isLoading || !statusQ.data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("certificate.loading")}
        </CardContent>
      </Card>
    );
  }

  const { eligible, certificate, progress } = statusQ.data;
  const lang = i18n.language.startsWith("ja") ? "ja" : "en";

  // ---- Already issued ----
  if (certificate && !certificate.revoked_at) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Award className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t("certificate.issued.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("certificate.issued.description", {
                  number: certificate.certificate_number,
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => downloadMut.mutate(certificate.id)}
              disabled={downloadMut.isPending}
            >
              {downloadMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t("certificate.download")}
            </Button>
            <Button
              variant="outline"
              onClick={() => issueMut.mutate(lang)}
              disabled={issueMut.isPending}
              title={t("certificate.reissueHint") ?? ""}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("certificate.reissue")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Eligible, not issued yet ----
  if (eligible) {
    return (
      <Card className="border-primary/40 bg-gradient-to-r from-primary/10 via-secondary/5 to-background">
        <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/15 p-3 text-primary">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t("certificate.eligible.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("certificate.eligible.description")}
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => issueMut.mutate(lang)} disabled={issueMut.isPending}>
            {issueMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Award className="mr-2 h-4 w-4" />
            )}
            {t("certificate.generate")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Not eligible: show progress remaining ----
  const remaining = Math.max(0, progress.totalLessons - progress.completedLessons);
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3 py-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <Award className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{t("certificate.locked.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("certificate.locked.description", { remaining })}
            </p>
            <div className="mt-3 space-y-1">
              <Progress
                value={progress.percentage}
                aria-label={t("certificate.locked.title") ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                {progress.completedLessons} / {progress.totalLessons} ·{" "}
                {Math.round(progress.percentage)}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
