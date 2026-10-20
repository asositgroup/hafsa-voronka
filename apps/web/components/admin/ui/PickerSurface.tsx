"use client";

import * as Popover from "@radix-ui/react-popover";
import { useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode, Ref } from "react";
import { Sheet } from "@/components/admin/ui/Dialog";

const query = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type PickerSurfaceProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  trigger: (props: { ref: Ref<HTMLButtonElement>; onClick: () => void; open: boolean }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
};

export function PickerSurface({ open, onOpenChange, title, trigger, children, align = "start" }: PickerSurfaceProps) {
  const desktop = useIsDesktop();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement | undefined>();

  const handleOpenChange = (next: boolean) => {
    if (next) setContainer(triggerRef.current?.closest("dialog") ?? undefined);
    onOpenChange(next);
  };

  if (!desktop) {
    return (
      <>
        {trigger({ ref: triggerRef, onClick: () => handleOpenChange(true), open })}
        <Sheet open={open} onClose={() => handleOpenChange(false)} title={title}>
          {children}
        </Sheet>
      </>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Anchor asChild>
        <span className="block min-w-0">{trigger({ ref: triggerRef, onClick: () => handleOpenChange(!open), open })}</span>
      </Popover.Anchor>
      <Popover.Portal container={container}>
        <Popover.Content
          aria-label={title}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            const target = (event.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-autofocus]");
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          onInteractOutside={(event) => {
            if (triggerRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          className="z-[60] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-[16px] border border-chiziq bg-white p-3 text-siyoh shadow-[0_16px_40px_-10px_rgba(18,59,51,0.3)] outline-none motion-safe:transition-[opacity,translate] motion-safe:duration-150 data-[state=open]:starting:-translate-y-1 data-[state=open]:starting:opacity-0"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
