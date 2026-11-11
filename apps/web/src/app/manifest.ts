import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recuidado",
    short_name: "Recuidado",
    description: "Cuida do remédio do idoso junto com a família.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#0b5d57",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
