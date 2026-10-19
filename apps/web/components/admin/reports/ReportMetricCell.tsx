import { reportPercent } from "@funnel/shared";

type Props = {
  count: number | null;
  base: number;
};

export function ReportMetricCell({ count, base }: Props) {
  const percent = reportPercent(count, base);

  return (
    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
      {count === null ? (
        <span className="text-qalam">—</span>
      ) : (
        <>
          <span className="block font-semibold text-siyoh">{count}</span>
          <span className="block text-[12px] text-qalam">{percent}%</span>
        </>
      )}
    </td>
  );
}
