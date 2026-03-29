import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => item.replace(/^https?:\/\//, "").replace(/:\d+$/, ""));

const nextConfig: NextConfig = {
  typedRoutes: true,
  allowedDevOrigins,
};

export default nextConfig;
