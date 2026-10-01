import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nehir Akademi",
    short_name: "Nehir",
    description: "Kişisel öğrenme alanın",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7fc",
    theme_color: "#7651c9",
    lang: "tr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
