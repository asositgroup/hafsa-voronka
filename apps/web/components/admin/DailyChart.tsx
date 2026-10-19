"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyStat } from "@funnel/shared";
import { Section } from "@/components/admin/ui/Section";
import { useMounted } from "@/lib/admin/useMounted";
import { adminUz } from "@/lib/i18n/admin";

export function DailyChart({ daily }: { daily: DailyStat[] }) {
  const mounted = useMounted();

  const formattedData = daily.map((d) => ({
    ...d,
    displayDate: d.date.slice(5),
  }));

  return (
    <Section title={adminUz.daily.title}>

      <div className="h-72 sm:h-80 w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedData}
              margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                stroke="var(--color-chiziq)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="displayDate"
                stroke="var(--color-qalam)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="var(--color-qalam)"
                fontSize={12}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as DailyStat;
                  return (
                    <div className="rounded-[10px] border border-chiziq bg-white px-3 py-2 text-[13px] text-siyoh">
                      <div className="font-semibold text-siyoh mb-1">{item.date}</div>
                      <div className="flex items-center gap-2 text-siyoh">
                        <span className="h-2 w-2 rounded-full bg-siyoh" />
                        <span>{adminUz.daily.registrations}:</span>
                        <span className="font-bold tabular-nums">{item.registrations}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zumrad mt-1">
                        <span className="h-2 w-2 rounded-full bg-zumrad" />
                        <span>{adminUz.daily.completions}:</span>
                        <span className="font-bold tabular-nums">{item.completions}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: "10px", fontSize: "12px" }}
                formatter={(value) => (
                  <span className="text-xs text-qalam">
                    {value === "registrations"
                      ? adminUz.daily.registrations
                      : adminUz.daily.completions}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="registrations"
                stroke="var(--color-siyoh)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-siyoh)" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="completions"
                stroke="var(--color-zumrad)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-zumrad)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-qalam">
            {adminUz.common.loading}
          </div>
        )}
      </div>
    </Section>
  );
}
