"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Option = { value: string; label: string };

// Select do shadcn com rótulos (Base UI mostra o `value` cru sem `items`).
export function FieldSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(v) => v != null && onValueChange(String(v))}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className="w-full data-[size=default]:h-10 md:data-[size=default]:h-8">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
