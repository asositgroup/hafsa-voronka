"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { inputClass } from "@/components/admin/ui/Field";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

export function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  invalid = false,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}: SelectProps) {
  const [container, setContainer] = useState<HTMLElement | undefined>();

  return (
    <RadixSelect.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      onOpenChange={(open) => {
        if (open) setContainer(document.activeElement?.closest("dialog") ?? undefined);
      }}
    >
      <RadixSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={`${inputClass(invalid)} flex cursor-pointer items-center justify-between gap-2 text-left data-[placeholder]:text-qalam/60 ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon asChild>
          <ChevronDownIcon className="h-4 w-4 text-qalam" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal container={container}>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[60] max-h-[min(20rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[10rem] overflow-hidden rounded-[12px] border border-chiziq bg-white text-siyoh shadow-[0_12px_32px_-8px_rgba(18,59,51,0.28)] motion-safe:transition-[opacity,translate] motion-safe:duration-150 data-[state=open]:starting:-translate-y-1 data-[state=open]:starting:opacity-0"
        >
          <RadixSelect.ScrollUpButton className="flex h-7 items-center justify-center bg-white text-qalam">
            <ChevronDownIcon className="h-4 w-4 rotate-180" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-11 cursor-pointer select-none items-center rounded-[8px] py-2 pl-3 pr-9 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-varaq data-[state=checked]:font-semibold"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-3 inline-flex">
                  <CheckIcon className="h-4 w-4 text-zumrad" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex h-7 items-center justify-center bg-white text-qalam">
            <ChevronDownIcon className="h-4 w-4" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
