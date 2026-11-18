"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => <TabsPrimitive.List ref={ref} className={cn("flex items-center gap-1 border-b border-border", className)} {...props} />,
);
TabsList.displayName = "TabsList";
export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn("-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink", className)}
      {...props}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";
export const TabsContent = TabsPrimitive.Content;

/** Compact pill-style segmented control (used for chart ranges, toggles). */
export function Segmented<T extends string>({ value, onChange, options, size = "sm", className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; size?: "xs" | "sm"; className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-md border border-border-strong bg-surface p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[5px] font-medium transition-colors",
            size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
            value === o.value ? "bg-ink text-white" : "text-ink-2 hover:bg-page",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
