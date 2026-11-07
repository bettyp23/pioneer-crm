// The app icon artwork, rendered to PNG by next/og (inline styles only).
export function PioneerMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#ffffff",
        fontSize: Math.round(size * 0.55),
        fontWeight: 700,
      }}
    >
      P
    </div>
  );
}
