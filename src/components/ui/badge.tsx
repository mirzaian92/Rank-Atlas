import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-brand-soft text-brand",
      outline: "border border-border-strong text-ink-2",
      muted: "bg-page text-ink-2",
      mock: "bg-[#fff4d6] text-[#7a5300] border border-[#f3d27a]",
      live: "bg-[#e3f6e3] text-good-text border border-[#a9dca9]",
      good: "bg-[#e3f6e3] text-good-text",
      warning: "bg-[#fff4d6] text-[#7a5300]",
      critical: "bg-[#fbe5e5] text-[#a12424]",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
