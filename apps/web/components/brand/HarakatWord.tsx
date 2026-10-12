import { harakatWords, type HarakatWordKey } from "./harakatPaths";

type HarakatWordProps = {
  word: HarakatWordKey;
  className?: string;
  lettersClassName?: string;
};

export function HarakatWord({
  word,
  className = "",
  lettersClassName = "fill-varaq",
}: HarakatWordProps) {
  const { text, viewBox, letters, marks } = harakatWords[word];
  return (
    <svg viewBox={viewBox} role="img" aria-label={text} lang="ar" className={`block w-auto ${className}`}>
      <path d={letters} className={lettersClassName} />
      {marks && <path d={marks} className="fill-oltin" />}
    </svg>
  );
}
