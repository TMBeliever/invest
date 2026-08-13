import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const isDev = process.env.NODE_ENV === "development";
    const defaultBackend = isDev ? "http://127.0.0.1:8000" : "http://server:8000";
    const backendUrl = process.env.INTERNAL_API_URL || defaultBackend;
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
