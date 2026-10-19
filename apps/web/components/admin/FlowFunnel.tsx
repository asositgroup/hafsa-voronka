"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { Section } from "@/components/admin/ui/Section";
import { adminUz } from "@/lib/i18n/admin";

export type FlowStage = {
  key: string;
  label: string;
  count: number;
};

const BAND_HEIGHT = 168;
const COLUMN_WIDTH = 100;
const MIN_SHARE = 0.14;
const EMPTY_HEIGHT = 3;

const countFormat = new Intl.NumberFormat("uz-UZ");

function percentOf(count: number, base: number) {
  return base > 0 ? `${Math.round((count / base) * 1000) / 10}%` : "—";
}

function bandHeight(count: number, max: number) {
  if (count <= 0) return EMPTY_HEIGHT;
  const share = max > 0 ? Math.log1p(count) / Math.log1p(max) : 0;
  return BAND_HEIGHT * (MIN_SHARE + (1 - MIN_SHARE) * share);
}

function bandPath(heights: number[]) {
  const knots = [...heights, heights[heights.length - 1]];
  const xs = knots.map((_, i) => i * COLUMN_WIDTH);
  const middle = BAND_HEIGHT / 2;
  const top = (i: number) => middle - knots[i] / 2;
  const bottom = (i: number) => middle + knots[i] / 2;

  let path = `M0 ${top(0)}`;
  for (let i = 1; i < knots.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    path += ` C${cx} ${top(i - 1)} ${cx} ${top(i)} ${xs[i]} ${top(i)}`;
  }
  path += ` L${xs[xs.length - 1]} ${bottom(knots.length - 1)}`;
  for (let i = knots.length - 1; i > 0; i--) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    path += ` C${cx} ${bottom(i)} ${cx} ${bottom(i - 1)} ${xs[i - 1]} ${bottom(i - 1)}`;
  }
  return `${path} Z`;
}

function BareFrame({ children }: { title?: string; description?: string; children?: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

type FlowFunnelProps = {
  title: string;
  subtitle?: string;
  stages: FlowStage[];
  bare?: boolean;
  compact?: boolean;
};

export function FlowFunnel({ title, subtitle, stages, bare = false, compact = false }: FlowFunnelProps) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  if (stages.length === 0) return null;

  const max = Math.max(...stages.map((stage) => stage.count), 1);
  const first = stages[0].count;
  const width = stages.length * COLUMN_WIDTH;
  const path = bandPath(stages.map((stage) => bandHeight(stage.count, max)));

  const Frame = bare ? BareFrame : Section;

  return (
    <Frame title={title} description={subtitle}>
      <div className="overflow-x-auto">
        <div
          className="relative"
          style={{ minWidth: compact ? undefined : `${stages.length * 84}px` }}
          onMouseLeave={() => setActive(null)}
        >
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
          >
            {stages.map((stage, i) => (
              <div
                key={stage.key}
                className={`flex flex-col gap-1.5 pb-4 ${compact ? "pr-1" : "pr-2"} ${i > 0 ? (compact ? "pl-1.5" : "pl-2.5") : ""}`}
              >
                <span className={`text-qalam leading-[1.35] ${compact ? "line-clamp-3 min-h-[3lh] text-[11px] sm:line-clamp-2 sm:min-h-[2lh] sm:text-xs" : "line-clamp-2 min-h-[2lh] text-xs"}`} title={stage.label}>
                  {stage.label}
                </span>
                <span className={`font-bold leading-none text-siyoh tabular-nums ${compact ? "text-[17px] sm:text-[20px]" : "text-[20px]"}`}>
                  {countFormat.format(stage.count)}
                </span>
              </div>
            ))}
          </div>

          <div className="relative" style={{ height: `${BAND_HEIGHT}px` }}>
            <svg
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${width} ${BAND_HEIGHT}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#DCE8E2" />
                  <stop offset="100%" stopColor="#1E5C4D" />
                </linearGradient>
              </defs>
              <path d={path} fill={`url(#${gradientId})`} />
              {active !== null && (
                <rect
                  x={active * COLUMN_WIDTH}
                  y="0"
                  width={COLUMN_WIDTH}
                  height={BAND_HEIGHT}
                  fill="#123B33"
                  fillOpacity="0.06"
                />
              )}
            </svg>

            {stages.slice(1).map((stage, index) => (
              <span
                key={stage.key}
                aria-hidden="true"
                className={`pointer-events-none absolute top-1/2 z-[1] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-white py-1 font-semibold ${compact ? "px-1.5 text-[11px] sm:px-2.5 sm:text-xs" : "px-2.5 text-xs"} text-siyoh tabular-nums shadow-[0_1px_4px_rgba(18,59,51,.18)]`}
                style={{ left: `${((index + 1) / stages.length) * 100}%` }}
              >
                {percentOf(stage.count, stages[index].count)}
                <ArrowRightIcon className="h-3 w-3" />
              </span>
            ))}
          </div>

          {stages.slice(1).map((stage, index) => (
            <span
              key={stage.key}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-px bg-chiziq"
              style={{ left: `${((index + 1) / stages.length) * 100}%` }}
            />
          ))}

          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
          >
            {stages.map((stage, i) => (
              <div
                key={stage.key}
                tabIndex={0}
                className="relative outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-siyoh/40 rounded-[10px]"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                {active === i && (
                  <div
                    role="tooltip"
                    className={`pointer-events-none absolute bottom-3 z-10 w-max min-w-[160px] rounded-[10px] bg-siyoh px-3 py-2 text-xs text-varaq shadow-lg ${
                      i >= stages.length - 2 ? "right-2" : "left-2"
                    }`}
                  >
                    <p className="m-0 font-semibold">{stage.label}</p>
                    <p className="m-0 mt-1 tabular-nums">{countFormat.format(stage.count)}</p>
                    {i > 0 && (
                      <p className="m-0 mt-1 text-kumush tabular-nums">
                        {adminUz.flow.fromPrevious}: {percentOf(stage.count, stages[i - 1].count)}
                      </p>
                    )}
                    {i > 0 && (
                      <p className="m-0 text-kumush tabular-nums">
                        {adminUz.flow.fromFirst}: {percentOf(stage.count, first)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{adminUz.flow.stage}</th>
            <th scope="col">{adminUz.flow.count}</th>
            <th scope="col">{adminUz.flow.fromPrevious}</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage, i) => (
            <tr key={stage.key}>
              <th scope="row">{stage.label}</th>
              <td>{stage.count}</td>
              <td>{i > 0 ? percentOf(stage.count, stages[i - 1].count) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}
