"use client";
import { useState } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const qc: QueryClient = new QueryClient({
      defaultOptions: { queries: { refetchOnWindowFocus: false } },
      queryCache: new QueryCache({
        // Any report that touched the provider (live or cache) refreshes the header spend meter.
        onSuccess: (data, query) => {
          const source = (data as { meta?: { source?: string } } | undefined)?.meta?.source;
          if (query.queryKey[0] === "report" && source && source !== "mock") qc.invalidateQueries({ queryKey: ["usage-meter"] });
        },
        onError: (_err, query) => {
          if (query.queryKey[0] === "report") qc.invalidateQueries({ queryKey: ["usage-meter"] });
        },
      }),
    });
    return qc;
  });
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
