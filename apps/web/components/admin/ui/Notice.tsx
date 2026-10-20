import type { ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

export type NoticeTone = "info" | "attention" | "danger" | "success";

const toneClass: Record<NoticeTone, string> = {
  info: "bg-varaq text-siyoh",
  attention: "bg-oltin/20 text-siyoh",
  danger: "bg-anor/10 text-anor",
  success: "bg-zumrad/12 text-zumrad",
};

type NoticeProps = {
  tone: NoticeTone;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
};

export function Notice({ tone, children, action, onDismiss }: NoticeProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-[12px] px-3.5 py-3 text-sm ${toneClass[tone]}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={adminUz.common.dismiss}
          className="-m-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] hover:bg-siyoh/10 focus-visible:outline-2 focus-visible:outline-siyoh"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
