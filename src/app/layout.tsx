import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { APP_NAME, APP_TAGLINE } from "@/lib/config/site";

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: "SEO research and analytics: domains, keywords, backlinks, rankings and site audits.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
