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
import { useMounted } from "@/lib/admin/useMounted";
import { adminUz } from "@/lib/i18n/admin";

export function DailyChart({ daily }: { daily: DailyStat[] }) {
  const mounted = useMounted();

  const formattedData = daily.map((d) => ({
    ...d,
    displayDate: d.date.slice(5),
  }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100">
          {adminUz.daily.title}
        </h2>
      </div>

      <div className="h-72 sm:h-80 w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedData}
              margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
            >
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="displayDate"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as DailyStat;
                  return (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
                      <div className="font-semibold text-white mb-1.5">{item.date}</div>
                      <div className="flex items-center gap-2 text-indigo-400">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        <span>{adminUz.daily.registrations}:</span>
                        <span className="font-bold">{item.registrations}</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-400 mt-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>{adminUz.daily.completions}:</span>
                        <span className="font-bold">{item.completions}</span>
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
                  <span className="text-xs text-zinc-300">
                    {value === "registrations"
                      ? adminUz.daily.registrations
                      : adminUz.daily.completions}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="registrations"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, fill: "#6366f1" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="completions"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: "#10b981" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">
            {adminUz.common.loading}
          </div>
        )}
      </div>
    </div>
  );
}
