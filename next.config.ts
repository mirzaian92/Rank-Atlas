import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages must never be bundled for the browser.
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
};

export default nextConfig;
