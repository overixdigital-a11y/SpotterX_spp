import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SpotterX",
    short_name: "SpotterX",
    description: "La comunidad fit. Entrená, conectá y crecé.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05070a",
    theme_color: "#05070a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
