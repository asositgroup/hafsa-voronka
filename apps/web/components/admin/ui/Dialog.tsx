"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/admin/ui/Button";
import { IconButton } from "@/components/admin/ui/IconButton";
import { adminUz } from "@/lib/i18n/admin";

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return ref;
}

const entrance = "motion-safe:transition-[opacity,translate] motion-safe:duration-150 starting:opacity-0";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "default" | "wide";
  footer?: ReactNode;
  children: ReactNode;
};

export function Sheet({ open, onClose, title, size = "default", footer, children }: SheetProps) {
  const ref = useModal(open);
  const width = size === "wide" ? "lg:w-[960px]" : "lg:w-[560px]";

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`${entrance} starting:translate-y-3 fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-[20px] border-0 bg-white p-0 text-siyoh backdrop:bg-siyoh/40 open:flex lg:inset-y-0 lg:left-auto lg:right-0 lg:h-dvh lg:max-h-none lg:max-w-[100vw] lg:rounded-none lg:rounded-l-[20px] lg:starting:translate-x-3 lg:starting:translate-y-0 ${width}`}
    >
      {open && (
        <>
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-chiziq px-4 py-3 sm:px-5">
            <h2 className="m-0 min-w-0 truncate text-[17px] font-semibold text-siyoh">{title}</h2>
            <IconButton label={adminUz.messages.editor.close} icon={<CloseIcon className="h-5 w-5" />} onClick={onClose} />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
          {footer && (
            <footer className="shrink-0 border-t border-chiziq bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, description, confirmLabel, busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useModal(open);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className={`${entrance} starting:translate-y-2 m-auto w-[calc(100%-32px)] max-w-md rounded-[20px] border-0 bg-white p-5 text-siyoh backdrop:bg-siyoh/40`}
    >
      {open && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-[17px] font-semibold text-siyoh">{title}</h2>
            {description && <p className="m-0 text-sm text-qalam">{description}</p>}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" disabled={busy} onClick={onCancel}>
              {adminUz.confirm.cancel}
            </Button>
            <Button variant="danger" loading={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
