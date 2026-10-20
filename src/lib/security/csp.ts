// Content-Security-Policy builder (docs/security.md §8). Pure function so it can be
// unit-tested and used from src/proxy.ts.

export function buildCsp({
  nonce,
  supabaseUrl,
  isDev,
}: {
  nonce: string;
  supabaseUrl: string;
  isDev: boolean;
}): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const directives = [
    "default-src 'self'",
    // React needs eval in development only for debugging; never in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Radix/sonner set inline style attributes; styles cannot execute code.
    "style-src 'self' 'unsafe-inline'",
    // data: for the TOTP enrollment QR code (SVG data URI from Supabase Auth).
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}
