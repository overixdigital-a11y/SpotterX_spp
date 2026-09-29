import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las fotos de ejercicios que sube el admin viven en el bucket `media` de
  // Supabase. Sin esto `next/image` las rechaza por host desconocido.
  //
  // Van por el optimizador a proposito: el admin sube fotos de 2-3 MB del
  // celu y acá se sirven a un par de KB para los 36-40 px de la lista.
  //
  // SOLO se agrega `remotePatterns`. No se tocan deviceSizes/imageSizes/
  // qualities porque son GLOBALES: cambiarlos dejaria los avatares, las fotos
  // de posts y las del market con una sola resolución disponible.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dzalgziofiwcljgnphap.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
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
