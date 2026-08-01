import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listSettings, updateSetting } from "@/lib/admin/settings.admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

type Setting = { key: string; value: unknown; is_public: boolean };

function AdminSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const list = useServerFn(listSettings);
  const upd = useServerFn(updateSetting);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => list(),
  });

  const mut = useMutation({
    mutationFn: (p: { key: string; value: unknown }) => upd({ data: p }),
    onSuccess: () => {
      toast.success(t("admin.settings_.saved"));
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [local, setLocal] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (data) {
      const map: Record<string, unknown> = {};
      for (const s of data as Setting[]) map[s.key] = s.value;
      setLocal(map);
    }
  }, [data]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const groups: Array<{ title: string; keys: string[] }> = [
    {
      title: t("admin.settings_.groups.platform"),
      keys: ["platform_name", "support_email", "display_price_jpy"],
    },
    {
      title: t("admin.settings_.groups.institutional"),
      keys: ["institutional_ja", "institutional_en"],
    },
    {
      title: t("admin.settings_.groups.legal"),
      keys: ["terms_ja", "terms_en", "privacy_ja", "privacy_en"],
    },
    { title: t("admin.settings_.groups.playback"), keys: ["video_completion_threshold"] },
    {
      title: t("admin.settings_.groups.payments"),
      keys: ["payments.sandbox_grants_access"],
    },
  ];


  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.settings_.subtitle")}</p>
      </header>

      {groups.map((g) => (
        <Card key={g.title}>
          <CardHeader>
            <CardTitle className="text-base">{g.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {g.keys.map((k) => (
              <SettingField
                key={k}
                keyName={k}
                value={local[k]}
                onChange={(v) => setLocal((s) => ({ ...s, [k]: v }))}
                onSave={() => mut.mutate({ key: k, value: local[k] })}
                onSaveValue={(v) => mut.mutate({ key: k, value: v })}
                saving={mut.isPending}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SettingField({
  keyName,
  value,
  onChange,
  onSave,
  onSaveValue,
  saving,
}: {
  keyName: string;
  value: unknown;
  onChange: (v: unknown) => void;
  onSave: () => void;
  onSaveValue: (v: unknown) => void;
  saving: boolean;
}) {

  const { t } = useTranslation();
  const isLong =
    keyName.startsWith("terms_") ||
    keyName.startsWith("privacy_") ||
    keyName.startsWith("institutional_");
  const isNumber = keyName === "display_price_jpy" || keyName === "video_completion_threshold";
  const isBoolean = keyName === "payments.sandbox_grants_access";

  if (isBoolean) {
    const checked = value === true || value === "true";
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor={keyName}>
            {t(`admin.settings_.keys.${keyName}`, { defaultValue: keyName })}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(`admin.settings_.keys.${keyName}_hint`, { defaultValue: "" })}
          </p>
        </div>
        <Switch
          id={keyName}
          checked={checked}
          disabled={saving}
          onCheckedChange={(v) => {
            onChange(v);
            onSaveValue(v);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={keyName}>
        {t(`admin.settings_.keys.${keyName}`, { defaultValue: keyName })}
      </Label>
      <div className="flex gap-2">

        {isLong ? (
          <Textarea
            id={keyName}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="flex-1"
          />
        ) : (
          <Input
            id={keyName}
            type={isNumber ? "number" : "text"}
            value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
            onChange={(e) => onChange(isNumber ? Number(e.target.value) || 0 : e.target.value)}
            className="flex-1"
          />
        )}
        <Button size="sm" variant="outline" onClick={onSave} disabled={saving}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
