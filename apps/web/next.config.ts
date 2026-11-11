import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image small for Coolify.
  output: "standalone",
};

export default nextConfig;
