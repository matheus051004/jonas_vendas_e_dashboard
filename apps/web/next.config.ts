import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jonas/db", "@jonas/shared"],
};

export default nextConfig;
