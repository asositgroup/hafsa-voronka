import type { ReactNode } from "react";

export function Page({ width = "wide", children }: { width?: "wide" | "narrow"; children: ReactNode }) {
  const max = width === "wide" ? "max-w-6xl" : "max-w-3xl";
  return <div className={`mx-auto flex w-full flex-col gap-6 ${max}`}>{children}</div>;
}

type PageHeaderProps = {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <h1 className="m-0 text-2xl font-bold leading-[1.2] text-siyoh lg:text-[28px]">{title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="m-0 text-sm text-qalam">{description}</p>}
      {meta && <div className="text-[13px] tabular-nums text-qalam">{meta}</div>}
    </header>
  );
}
