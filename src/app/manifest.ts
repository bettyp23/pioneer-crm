import type { MetadataRoute } from "next";

import { APP_BASE_PATH, publicPath } from "@/lib/mount";

// Lets the app be installed: iPhone Safari → Share → Add to Home Screen; desktop Chrome/Edge →
// the install icon in the address bar. It opens straight to the chat with Michael.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pioneer OS",
    short_name: "Pioneer",
    description: "Chat with Michael Scott.",
    start_url: publicPath("/dashboard"),
    // Trailing slash so the installed app does not claim /login-other.
    scope: `${APP_BASE_PATH}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      { src: publicPath("/app-icon/192"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: publicPath("/app-icon/512"), sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: publicPath("/app-icon/512"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
