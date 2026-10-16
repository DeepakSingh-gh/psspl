import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.VERCEL ? {} : { distDir: ".next-runtime" }),
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const port = process.env.CRM_API_PORT || "4000";
    return [{ source: "/api/:path*", destination: `http://127.0.0.1:${port}/api/:path*` }];
  },
};

export default nextConfig;
