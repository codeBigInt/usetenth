import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "usetenth",
    short_name: "usetenth",
    description: "Keep a tenth of every payment. We invest it for you.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7fb",
    theme_color: "#5b3df5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
