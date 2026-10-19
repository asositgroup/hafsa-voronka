"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";

type Step<T> = { value: T; label: string; hint: string };

type StepperProps<T extends string> = {
  label: string;
  steps: Step<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Stepper<T extends string>({ label, steps, value, onChange }: StepperProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.value === value),
  );

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + steps.length) % steps.length;
    refs.current[next]?.focus();
    onChange(steps[next].value);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={label} className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const selected = index === activeIndex;
          const reached = index <= activeIndex;
          return (
            <button
              key={step.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(step.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="flex min-h-11 flex-col items-center gap-1.5 rounded-[10px] px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
            >
              <span className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${index === 0 ? "bg-transparent" : reached ? "bg-siyoh" : "bg-chiziq"}`} />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums ${
                    selected
                      ? "border-siyoh bg-siyoh text-varaq"
                      : reached
                        ? "border-siyoh bg-white text-siyoh"
                        : "border-chegara/60 bg-white text-qalam"
                  }`}
                >
                  {index + 1}
                </span>
                <span className={`h-0.5 flex-1 ${index === steps.length - 1 ? "bg-transparent" : index < activeIndex ? "bg-siyoh" : "bg-chiziq"}`} />
              </span>
              <span className={`text-center text-[13px] leading-tight ${selected ? "font-semibold text-siyoh" : "font-medium text-qalam"}`}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="m-0 text-sm text-siyoh">{steps[activeIndex].hint}</p>
    </div>
  );
}
