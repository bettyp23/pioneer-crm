// Money is stored as integer minor units + ISO-4217 currency (NFR-DATA-2).
// Values are always owner-entered; nothing here invents amounts.

const MAX_MINOR = 1_000_000_000_000; // $10bn guard against typos/overflow

// "12,500.50" / "$12500.5" / "12500" → 1250050. Empty → null. Invalid → undefined.
export function parseMoneyToMinor(input: string): number | null | undefined {
  const cleaned = input.trim().replace(/^\$/, "").replaceAll(",", "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) return undefined;
  return minor;
}

export function minorToInput(minor: number | null): string {
  if (minor === null) return "";
  return (minor / 100).toFixed(2).replace(/\.00$/, "");
}

export function formatMoney(minor: number | null, currency: string = "USD"): string {
  if (minor === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}
