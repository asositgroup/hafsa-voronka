import type { ReactNode } from "react";
import { Button } from "@/components/admin/ui/Button";
import { Section } from "@/components/admin/ui/Section";
import { adminUz } from "@/lib/i18n/admin";

const pulse = "motion-safe:animate-pulse rounded-[12px]";

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={`h-24 bg-white ${pulse}`} />
      ))}
    </div>
  );
}

export function LoadingState({ variant = "section", rows = 3 }: { variant?: "page" | "section" | "list"; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className={variant === "page" ? "mx-auto flex w-full max-w-6xl flex-col gap-6" : "flex flex-col gap-3"}>
      <span className="sr-only">{adminUz.common.loading}</span>
      {variant === "page" && (
        <>
          <div className="flex flex-col gap-2">
            <div className={`h-8 w-48 bg-white ${pulse}`} />
            <div className={`h-4 w-72 max-w-full bg-white ${pulse}`} />
          </div>
          <div className={`h-20 bg-white ${pulse}`} />
          <ListSkeleton rows={3} />
        </>
      )}
      {variant === "section" && <div className={`h-48 bg-white ${pulse}`} />}
      {variant === "list" && <ListSkeleton rows={rows} />}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <Section title={adminUz.common.errorTitle}>
      <p role="alert" className="m-0 text-sm text-qalam">
        {message ?? adminUz.common.errorHint}
      </p>
      {onRetry && (
        <div>
          <Button variant="secondary" onClick={onRetry}>
            {adminUz.common.retry}
          </Button>
        </div>
      )}
    </Section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white px-4 py-10 text-center">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[15px] font-semibold text-siyoh">{title}</p>
        {description && <p className="m-0 text-sm text-qalam">{description}</p>}
      </div>
      {action}
    </div>
  );
}
