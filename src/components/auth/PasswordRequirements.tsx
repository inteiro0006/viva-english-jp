import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { passwordChecks } from "@/lib/auth/schemas";
import { cn } from "@/lib/utils";

export function PasswordRequirements({ value }: { value: string }) {
  const { t } = useTranslation();
  const c = passwordChecks(value);
  const rules: Array<[boolean, string]> = [
    [c.length, t("auth.rules.length")],
    [c.lower, t("auth.rules.lower")],
    [c.upper, t("auth.rules.upper")],
    [c.digit, t("auth.rules.digit")],
  ];
  return (
    <ul className="mt-1 grid grid-cols-2 gap-1 text-xs">
      {rules.map(([ok, label]) => (
        <li
          key={label}
          className={cn(
            "flex items-center gap-1.5",
            ok ? "text-[color:var(--brand)]" : "text-muted-foreground",
          )}
        >
          {ok ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <X className="size-3.5" aria-hidden />
          )}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
