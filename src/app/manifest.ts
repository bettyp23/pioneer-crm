import type { MetadataRoute } from "next";

// Lets the app be installed: iPhone Safari → Share → Add to Home Screen; desktop Chrome/Edge →
// the install icon in the address bar. It opens straight to the chat with Michael.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pioneer OS",
    short_name: "Pioneer",
    description: "Chat with Michael Scott.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
