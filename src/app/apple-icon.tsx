import { ImageResponse } from "next/og";

import { PioneerMark } from "@/components/layout/pioneer-mark";

// Home-screen icon for iPhone/iPad ("Add to Home Screen").
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<PioneerMark size={180} />, size);
}
