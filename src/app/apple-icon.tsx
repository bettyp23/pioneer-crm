import { ImageResponse } from "next/og";

import { APP_ICON_MARK_SCALE, PioneerMark } from "@/components/layout/pioneer-mark";

// Home-screen icon for iPhone/iPad ("Add to Home Screen").
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const mark = Math.round(size.width * APP_ICON_MARK_SCALE);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
      }}
    >
      <PioneerMark size={mark} />
    </div>,
    size,
  );
}
