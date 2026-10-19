import { reportPercent } from "@funnel/shared";

type Props = {
  count: number | null;
  base: number;
};

export function MetricValue({ count, base }: Props) {
  if (count === null) return <span className="text-qalam">—</span>;
  return (
    <>
      <span className="block font-semibold text-siyoh">{count}</span>
      <span className="block text-xs font-normal text-qalam">{reportPercent(count, base)}%</span>
    </>
  );
}
