import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

type FieldIds = { id: string; describedBy?: string; invalid: boolean };

type FieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  counter?: ReactNode;
  suffix?: ReactNode;
  hideLabel?: boolean;
  className?: string;
  children: (ids: FieldIds) => ReactNode;
};

export function Field({ label, hint, error, counter, suffix, hideLabel = false, className = "", children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const invalid = Boolean(error);
  const note = error ?? hint;
  const hasNote = Boolean(note) || Boolean(counter);

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium text-siyoh"}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{children({ id, describedBy: hasNote ? noteId : undefined, invalid })}</div>
        {suffix && <span className="shrink-0 text-sm text-qalam">{suffix}</span>}
      </div>
      {hasNote && (
        <div id={noteId} className="flex items-start justify-between gap-3 text-[13px]">
          {error ? (
            <span role="alert" className="text-anor">
              {error}
            </span>
          ) : (
            <span className="text-qalam">{hint}</span>
          )}
          {counter && <span className="ml-auto shrink-0 tabular-nums text-qalam">{counter}</span>}
        </div>
      )}
    </div>
  );
}

export function inputClass(invalid = false) {
  return `h-11 w-full min-w-0 rounded-[10px] border bg-white px-3 text-sm text-siyoh outline-none transition-colors placeholder:text-qalam/60 focus:border-siyoh focus:ring-2 focus:ring-siyoh/15 disabled:opacity-60 ${
    invalid ? "border-anor" : "border-chegara/60"
  }`;
}

type WithInvalid = { invalid?: boolean };

export function Input({ invalid, className = "", ...rest }: ComponentProps<"input"> & WithInvalid) {
  return <input {...rest} aria-invalid={invalid || undefined} className={`${inputClass(invalid)} ${className}`} />;
}

export function Textarea({ invalid, className = "", ...rest }: ComponentProps<"textarea"> & WithInvalid) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${inputClass(invalid).replace("h-11 ", "")} resize-y py-2.5 leading-[1.5] ${className}`}
    />
  );
}
