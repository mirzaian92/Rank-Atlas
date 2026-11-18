import { Info } from "lucide-react";
import { Hint } from "@/components/ui/tooltip";

export function InfoTip({ content }: { content: React.ReactNode }) {
  return (
    <Hint content={content}>
      <button type="button" className="inline-flex text-ink-3 hover:text-ink-2" aria-label="More information">
        <Info className="size-3.5" />
      </button>
    </Hint>
  );
}
