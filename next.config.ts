import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
      ],
    },
    // Las miniaturas son archivos con hash en el nombre: se pueden cachear
    // para siempre. Va DESPUES de la regla global para que esta gane.
    {
      source: "/exercises/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ],
};

export default nextConfig;
