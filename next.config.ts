import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages must never be bundled for the browser.
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
  experimental: {
    // Next 16.4's persistent Turbopack dev cache can restore a stale HMR state after a restart,
    // so every page load answers "HMR hash mismatch" and reloads — an endless reload loop
    // (vercel/next.js#100267, open as of Nov 2026). Restarts with changed env vars trigger it
    // reliably. Re-enable once that issue is fixed; it only affects `next dev` startup speed.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
