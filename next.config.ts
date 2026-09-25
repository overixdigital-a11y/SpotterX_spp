import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
      ],
    },
  ],
};

export default nextConfig;
