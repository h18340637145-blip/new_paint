import Link from "next/link";
import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface AuthStatusCardProps {
  tone: "info" | "success" | "error";
  title: string;
  description: string;
  detail?: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  children?: React.ReactNode;
}

export function AuthStatusCard({
  tone,
  title,
  description,
  detail,
  primaryAction,
  secondaryAction,
  children,
}: AuthStatusCardProps) {
  const badgeConfig =
    tone === "error"
      ? {
          icon: AlertCircle,
          label: "验证或登录未完成",
          cls: "border-red-200 bg-red-50 text-red-800",
        }
      : tone === "success"
        ? {
            icon: CheckCircle2,
            label: "操作已完成",
            cls: "border-emerald-200 bg-emerald-50 text-emerald-800",
          }
        : {
            icon: MailCheck,
            label: "等待邮箱确认",
            cls: "border-amber-200 bg-amber-50 text-amber-900",
          };

  const Icon = badgeConfig.icon;

  return (
    <div className="flex w-full items-center justify-center">
      <div className="w-full max-w-md">
        <Card className="border-neutral-200/90 shadow-sm">
          <CardHeader className="space-y-3">
            <div
              role={tone === "error" ? "alert" : "status"}
              className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badgeConfig.cls}`}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{badgeConfig.label}</span>
            </div>
            <CardTitle className="text-2xl tracking-tight text-neutral-950">{title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed text-neutral-600">
              {description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {detail && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-700">
                {detail}
              </div>
            )}

            {children}

            {(primaryAction || secondaryAction) && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {primaryAction && (
                  <Link
                    href={primaryAction.href}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#164b3e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123d32]"
                  >
                    {primaryAction.label}
                  </Link>
                )}
                {secondaryAction && (
                  <Link
                    href={secondaryAction.href}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
                  >
                    {secondaryAction.label}
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
