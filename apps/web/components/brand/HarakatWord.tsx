import type { CSSProperties } from "react";

type HarakatWordProps = {
  text: string;
  bareText?: string;
  className?: string;
  style?: CSSProperties;
};

export function HarakatWord({
  text,
  bareText,
  className = "",
  style,
}: HarakatWordProps) {
  if (!bareText) {
    return (
      <span
        dir="rtl"
        aria-label={text}
        className={`font-arabic text-siyoh select-none whitespace-nowrap ${className}`}
        style={style}
      >
        {text}
      </span>
    );
  }

  return (
    <div
      dir="rtl"
      aria-label={text}
      role="img"
      className={`relative font-arabic leading-none select-none whitespace-nowrap ${className}`}
      style={style}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 text-right text-oltin pointer-events-none whitespace-nowrap"
      >
        {text}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 text-right text-varaq pointer-events-none whitespace-nowrap"
        style={{ WebkitTextStroke: "0.5px var(--color-varaq)" }}
      >
        {bareText}
      </span>
      <span className="sr-only">{text}</span>
    </div>
  );
}
