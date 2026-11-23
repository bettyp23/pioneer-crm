import { readFileSync } from "node:fs";
import { join } from "node:path";

// Local file so icon generation does not depend on the public site being up.
// next/og only accepts an absolute URL, a data URI, or image bytes.
const markBytes = readFileSync(join(process.cwd(), "public/brand/pioneer-p-mark.png"));
const markWidth = markBytes.readUInt32BE(16);
const markHeight = markBytes.readUInt32BE(20);
const markSrc = `data:image/png;base64,${markBytes.toString("base64")}`;

/** Share of a square icon taken by the mark. The rest is white padding. */
export const APP_ICON_MARK_SCALE = 0.68;

// The mark artwork, rendered to PNG by next/og (inline styles only).
// `size` is the width of the box the mark is fitted into.
export function PioneerMark({ size }: { size: number }) {
  const width = Math.max(1, Math.round(size));
  const height = Math.max(1, Math.round((width * markHeight) / markWidth));
  return (
    // next/og draws this. next/image cannot, and the mark is decorative here.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" src={markSrc} width={width} height={height} style={{ width, height }} />
  );
}
