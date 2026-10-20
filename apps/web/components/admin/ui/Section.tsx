import type { ReactNode } from "react";

type SectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  as?: "section" | "article";
  inset?: boolean;
  className?: string;
  children?: ReactNode;
};

export function Section({ title, description, actions, as: Tag = "section", inset = false, className = "", children }: SectionProps) {
  const surface = inset ? "rounded-[12px] bg-varaq p-3" : "rounded-[16px] bg-white p-4 sm:p-5";
  const hasHeader = title || description || actions;

  return (
    <Tag className={`flex flex-col gap-3 ${surface} ${className}`}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="m-0 text-[17px] font-semibold leading-snug text-siyoh">{title}</h2>}
            {description && <p className="m-0 mt-0.5 text-[13px] text-qalam">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function Card(props: Omit<SectionProps, "as">) {
  return <Section {...props} as="article" />;
}
