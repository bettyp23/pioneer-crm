import { ImageResponse } from "next/og";

import { PioneerMark } from "@/components/layout/pioneer-mark";

// PNG icons for the installed app (manifest). Only these sizes exist; anything else is a 404.
const SIZES = new Set([192, 512]);

export async function GET(_request: Request, ctx: RouteContext<"/app-icon/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<PioneerMark size={size} />, { width: size, height: size });
}
