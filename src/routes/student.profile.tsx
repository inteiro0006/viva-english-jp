import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, Loader2, Trash2 } from "lucide-react";

import i18n from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  getProfileOverview,
  signAvatarUrl,
  updateProfile,
} from "@/lib/profile/profile.functions";
import { localizeAuthError } from "@/lib/auth/messages";
import { makeResetSchema } from "@/lib/auth/schemas";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/student/profile")({
  head: () => ({
    meta: [
      { title: "プロフィール — Eigo Michi" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProfilePage,
});
const _headDone = true; void _headDone;
// @ts-ignore next-line
const __oldRoute__ = () => ({
    meta: [
      { title: "プロフィール — Eigo Michi" },
      { name: "description", content: "アカウント情報、学習設定、通知設定を管理します。" },
    ],
  }),
  component: ProfilePage,
});

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png"];

function ProfilePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getProfileOverview);
  const doUpdate = useServerFn(updateProfile);
  const doSign = useServerFn(signAvatarUrl);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => fetchOverview(),
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("student.profile.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("student.profile.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <p className="text-sm text-muted-foreground">{t("common.error")}</p>
            <Button variant="outline" onClick={() => void refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <IdentityCard
            data={data}
            onSaved={() => qc.invalidateQueries({ queryKey: ["profile-overview"] })}
            doUpdate={doUpdate}
            doSign={doSign}
          />
          <AccountReadonlyCard data={data} />
          <PasswordCard />
        </>
      )}
    </div>
  );
}

type OverviewData = Awaited<ReturnType<typeof getProfileOverview>>;

const profileFormSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  preferred_language: z.enum(["ja", "en"]),
  product_updates: z.boolean(),
  learning_reminders: z.boolean(),
  marketing: z.boolean(),
});

type ProfileForm = z.infer<typeof profileFormSchema>;

function IdentityCard({
  data,
  onSaved,
  doUpdate,
  doSign,
}: {
  data: OverviewData;
  onSaved: () => void;
  doUpdate: ReturnType<typeof useServerFn<typeof updateProfile>>;
  doSign: ReturnType<typeof useServerFn<typeof signAvatarUrl>>;
}) {
  const { t } = useTranslation();
  const profile = data.profile;
  const communicationPreferences = (profile?.communication_preferences ?? {
    product_updates: true,
    learning_reminders: true,
    marketing: false,
  }) as {
    product_updates?: boolean;
    learning_reminders?: boolean;
    marketing?: boolean;
  };

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      preferred_language: (profile?.preferred_language ?? "ja") as "ja" | "en",
      product_updates: communicationPreferences.product_updates ?? true,
      learning_reminders: communicationPreferences.learning_reminders ?? true,
      marketing: communicationPreferences.marketing ?? false,
    },
  });

  // Sign avatar URL for display when we have a path.
  const [displayAvatar, setDisplayAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(
    profile?.avatar_url ?? null,
  );
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!avatarPath) {
        setDisplayAvatar(null);
        return;
      }
      if (avatarPath.startsWith("http")) {
        setDisplayAvatar(avatarPath);
        return;
      }
      try {
        const res = await doSign({ data: { path: avatarPath } });
        if (active) setDisplayAvatar(res.url);
      } catch {
        if (active) setDisplayAvatar(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [avatarPath, doSign]);

  async function handleAvatar(file: File) {
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error(t("student.profile.errors.avatarType"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(t("student.profile.errors.avatarSize"));
      return;
    }
    const userId = profile?.id;
    if (!userId) return;
    setUploading(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      // Persist path in profile
      await doUpdate({
        data: {
          full_name: form.getValues("full_name") || profile.full_name,
          preferred_language: form.getValues("preferred_language"),
          avatar_url: path,
          communication_preferences: {
            product_updates: form.getValues("product_updates"),
            learning_reminders: form.getValues("learning_reminders"),
            marketing: form.getValues("marketing"),
          },
        },
      });
      setAvatarPath(path);
      onSaved();
      toast.success(t("student.profile.actions.saved"));
    } catch (err) {
      toast.error(
        (err as Error).message || t("student.profile.errors.avatarUpload"),
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!avatarPath || !profile?.id) return;
    setUploading(true);
    try {
      if (!avatarPath.startsWith("http")) {
        await supabase.storage.from("avatars").remove([avatarPath]);
      }
      await doUpdate({
        data: {
          full_name: form.getValues("full_name") || profile.full_name,
          preferred_language: form.getValues("preferred_language"),
          avatar_url: null,
          communication_preferences: {
            product_updates: form.getValues("product_updates"),
            learning_reminders: form.getValues("learning_reminders"),
            marketing: form.getValues("marketing"),
          },
        },
      });
      setAvatarPath(null);
      onSaved();
      toast.success(t("student.profile.actions.saved"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ProfileForm) =>
      doUpdate({
        data: {
          full_name: values.full_name,
          preferred_language: values.preferred_language,
          communication_preferences: {
            product_updates: values.product_updates,
            learning_reminders: values.learning_reminders,
            marketing: values.marketing,
          },
        },
      }),
    onSuccess: (_res, values) => {
      onSaved();
      if (i18n.language !== values.preferred_language) {
        void i18n.changeLanguage(values.preferred_language);
      }
      toast.success(t("student.profile.actions.saved"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("student.profile.errors.updateFailed"));
    },
  });

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("student.profile.sections.identity")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-6"
          onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
          noValidate
        >
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              {displayAvatar ? <AvatarImage src={displayAvatar} alt="" /> : null}
              <AvatarFallback>{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAvatar(f);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="size-4" aria-hidden />
                  )}
                  {t("student.profile.fields.changeAvatar")}
                </Button>
                {avatarPath ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={removeAvatar}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t("student.profile.fields.removeAvatar")}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("student.profile.fields.avatarHint")}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="full_name">
              {t("student.profile.fields.fullName")}
            </Label>
            <Input
              id="full_name"
              maxLength={120}
              {...form.register("full_name")}
              aria-invalid={!!form.formState.errors.full_name}
            />
          </div>

          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="preferred_language">
              {t("student.profile.fields.language")}
            </Label>
            <Select
              value={form.watch("preferred_language")}
              onValueChange={(v) =>
                form.setValue("preferred_language", v as "ja" | "en", {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="preferred_language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">{t("language.ja")}</SelectItem>
                <SelectItem value="en">{t("language.en")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            <h3 className="text-sm font-medium">
              {t("student.profile.sections.communication")}
            </h3>
            {(["product_updates", "learning_reminders", "marketing"] as const).map(
              (key) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {t(`student.profile.prefs.${key}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`student.profile.prefs.${key}Desc`)}
                    </p>
                  </div>
                  <Switch
                    checked={form.watch(key)}
                    onCheckedChange={(v) =>
                      form.setValue(key, v, { shouldDirty: true })
                    }
                  />
                </div>
              ),
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? t("student.profile.actions.saving")
                : t("student.profile.actions.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountReadonlyCard({ data }: { data: OverviewData }) {
  const { t, i18n: i } = useTranslation();
  const lang = i.language.startsWith("ja") ? "ja" : "en";
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
        dateStyle: "medium",
      }),
    [lang],
  );

  const activeEnrollment =
    data.enrollments.find((e) => e.status === "active") ??
    data.enrollments[0] ??
    null;
  const activeOrder =
    data.orders.find(
      (o) =>
        o.status === "paid" &&
        (!activeEnrollment ||
          !activeEnrollment.courses ||
          o.course_id === activeEnrollment.courses.id),
    ) ?? data.orders[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("student.profile.sections.account")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReadonlyRow
            label={t("student.profile.fields.email")}
            value={data.email ?? "—"}
            helper={t("student.profile.fields.emailHelp")}
          />
          <ReadonlyRow
            label={t("student.profile.fields.memberSince")}
            value={
              data.profile?.created_at
                ? dateFmt.format(new Date(data.profile.created_at))
                : "—"
            }
          />
          <ReadonlyRow
            label={t("student.profile.fields.course")}
            value={
              activeEnrollment?.courses
                ? lang === "ja"
                  ? activeEnrollment.courses.title_ja
                  : activeEnrollment.courses.title_en
                : t("student.profile.fields.noEnrollment")
            }
          />
          <ReadonlyRow
            label={t("student.profile.fields.enrollmentStatus")}
            value={
              activeEnrollment ? (
                <Badge variant="outline">{activeEnrollment.status}</Badge>
              ) : (
                "—"
              )
            }
          />
          <ReadonlyRow
            label={t("student.profile.fields.purchasedAt")}
            value={
              activeOrder?.paid_at
                ? dateFmt.format(new Date(activeOrder.paid_at))
                : activeOrder?.created_at
                  ? dateFmt.format(new Date(activeOrder.created_at))
                  : "—"
            }
          />
          <ReadonlyRow
            label={t("student.profile.fields.expiresAt")}
            value={
              activeEnrollment?.expires_at
                ? dateFmt.format(new Date(activeEnrollment.expires_at))
                : t("student.profile.fields.noExpiry")
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function ReadonlyRow({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
      {helper ? (
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

function PasswordCard() {
  const { t } = useTranslation();
  const schema = useMemo(() => makeResetSchema(t), [t]);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm_password: "" },
  });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(values: z.infer<typeof schema>) {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) {
        toast.error(localizeAuthError(error, t));
        return;
      }
      form.reset({ password: "", confirm_password: "" });
      toast.success(t("student.profile.password.success"));
    } catch (err) {
      toast.error(localizeAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  const password = form.watch("password") ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("student.profile.sections.password")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:max-w-md"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="new_password">
              {t("student.profile.password.new")}
            </Label>
            <PasswordInput
              id="new_password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
            <PasswordRequirements value={password} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm_password">
              {t("student.profile.password.confirm")}
            </Label>
            <PasswordInput
              id="confirm_password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.confirm_password}
              {...form.register("confirm_password")}
            />
            {form.formState.errors.confirm_password ? (
              <p className="text-xs text-[color:var(--urgent)]">
                {form.formState.errors.confirm_password.message}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t("common.loading")
                : t("student.profile.password.submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
