// Display helpers. Timestamps are stored in UTC and shown in the workspace timezone
// (NFR-DATA-2).

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium" }).format(new Date(iso));
}

// A calendar date column (YYYY-MM-DD) has no time zone; show it as written.
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
