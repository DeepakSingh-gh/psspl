import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the dev server's hot-reload artifacts separate from production builds.
  // Both commands used to share .next-runtime, so a build during `next dev`
  // could mix page bundles and webpack runtimes from different compilations.
  ...(!process.env.VERCEL ? { distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next-runtime" } : {}),
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const port = process.env.CRM_API_PORT || "4000";
    return [{ source: "/api/:path*", destination: `http://127.0.0.1:${port}/api/:path*` }];
  },
};

export default nextConfig;
