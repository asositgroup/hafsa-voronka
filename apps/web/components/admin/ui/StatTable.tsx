import { Fragment } from "react";
import type { ReactNode } from "react";

export type StatColumn<Row> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
  mobile?: "title" | "metric" | "hidden";
};

type StatGroup<Row> = { label: string; rows: Row[] };

type StatTableProps<Row> = {
  columns: StatColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  groups?: StatGroup<Row>[];
  empty: string;
};

export function StatTable<Row>({ columns, rows, rowKey, groups, empty }: StatTableProps<Row>) {
  const total = groups ? groups.reduce((sum, group) => sum + group.rows.length, 0) : rows.length;

  if (total === 0) {
    return <p className="m-0 py-6 text-center text-sm text-qalam">{empty}</p>;
  }

  const sections: { label: string | null; rows: Row[] }[] = groups ?? [{ label: null, rows }];
  const titleColumn = columns.find((column) => column.mobile === "title");
  const metricColumns = columns.filter((column) => (column.mobile ?? "metric") === "metric" && column !== titleColumn);

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-chiziq text-[13px] text-qalam">
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`py-2.5 font-normal ${index === 0 ? "pr-3" : "px-3"} ${column.align === "right" ? "text-right" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-chiziq text-sm text-siyoh">
            {sections.map((section, sectionIndex) => (
              <Fragment key={section.label ?? sectionIndex}>
                {section.label && (
                  <tr>
                    <th scope="colgroup" colSpan={columns.length} className="rounded-[10px] bg-varaq px-3 py-2 text-left text-[13px] font-semibold text-siyoh">
                      {section.label}
                    </th>
                  </tr>
                )}
                {section.rows.map((row) => (
                  <tr key={rowKey(row)}>
                    {columns.map((column, index) =>
                      index === 0 ? (
                        <th key={column.key} scope="row" className="py-2.5 pr-3 text-left font-medium">
                          {column.render(row)}
                        </th>
                      ) : (
                        <td key={column.key} className={`px-3 py-2.5 tabular-nums ${column.align === "right" ? "text-right" : ""}`}>
                          {column.render(row)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? sectionIndex} className="flex flex-col gap-2">
            {section.label && <h3 className="m-0 text-[15px] font-semibold text-siyoh">{section.label}</h3>}
            {section.rows.map((row) => (
              <article key={rowKey(row)} className="flex flex-col gap-3 rounded-[12px] bg-varaq p-3">
                {titleColumn && <div className="min-w-0">{titleColumn.render(row)}</div>}
                <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {metricColumns.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-xs text-qalam">{column.label}</dt>
                      <dd className="m-0 text-base font-semibold tabular-nums text-siyoh">{column.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
