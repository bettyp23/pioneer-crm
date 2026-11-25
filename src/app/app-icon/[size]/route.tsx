import { ImageResponse } from "next/og";

import { APP_ICON_MARK_SCALE, PioneerMark } from "@/components/layout/pioneer-mark";

// PNG icons for the installed app (manifest). Only these sizes exist; anything else is a 404.
const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export const dynamicParams = false;

export async function GET(_request: Request, ctx: RouteContext<"/app-icon/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.includes(size as (typeof SIZES)[number]))
    return new Response("Not found", { status: 404 });
  const mark = Math.round(size * APP_ICON_MARK_SCALE);
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
    { width: size, height: size },
  );
}
