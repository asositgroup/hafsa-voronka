"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FunnelStep } from "@funnel/shared";
import { useMounted } from "@/lib/admin/useMounted";
import { adminUz } from "@/lib/i18n/admin";

const BAR_COLORS = [
  "#3b82f6",
  "#0ea5e9",
  "#06b6d4",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#10b981",
  "#f59e0b",
];

export function FunnelChart({ funnel }: { funnel: FunnelStep[] }) {
  const mounted = useMounted();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100">
          {adminUz.funnel.title}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {adminUz.funnel.subtitle}
        </p>
      </div>

      <div className="h-80 sm:h-96 w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={funnel}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <XAxis
                type="number"
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#a1a1aa"
                fontSize={11}
                width={120}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as FunnelStep;
                  return (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
                      <div className="font-semibold text-white mb-1">{item.name}</div>
                      <div className="text-zinc-300">
                        {adminUz.funnel.countLabel}:{" "}
                        <span className="font-medium text-indigo-400">
                          {new Intl.NumberFormat("uz-UZ").format(item.count)}
                        </span>
                      </div>
                      <div className="text-zinc-300">
                        {adminUz.funnel.convLabel}:{" "}
                        <span className="font-medium text-emerald-400">
                          {item.conversionRate}%
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funnel.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">
            {adminUz.common.loading}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-zinc-800/80">
        {funnel.map((step, idx) => (
          <div key={step.step} className="rounded-lg bg-zinc-800/40 p-2 text-xs">
            <div className="text-zinc-400 truncate text-[11px] font-medium">
              {idx + 1}. {step.name}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-bold text-zinc-200">
                {new Intl.NumberFormat("uz-UZ").format(step.count)}
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  step.conversionRate >= 70
                    ? "text-emerald-400"
                    : step.conversionRate >= 40
                    ? "text-amber-400"
                    : "text-zinc-400"
                }`}
              >
                {step.conversionRate}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
