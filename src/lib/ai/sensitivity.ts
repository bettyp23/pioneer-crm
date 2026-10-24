// Pre-dispatch scanner (docs/security.md §7, FR-AGT-2). Flags content that should not leave
// Pioneer OS without a deliberate override. It is a safety net, not a guarantee: it errs on
// the side of flagging, and every override reason is audited.

export type SensitivityKind =
  | "email"
  | "phone"
  | "token_url"
  | "secret_key"
  | "card_number"
  | "ssn"
  | "health_term"
  | "opt_in_section";

export type SensitivityFlag = { kind: SensitivityKind; sample: string };

export const SENSITIVITY_LABELS: Record<SensitivityKind, string> = {
  email: "Email address",
  phone: "Phone number",
  token_url: "Link containing a token or key",
  secret_key: "Something that looks like an API key or secret",
  card_number: "Card-like number",
  ssn: "Social Security–like number",
  health_term: "Health-related term (no health information allowed)",
  opt_in_section: "Section you chose to include",
};

const HEALTH_TERMS = [
  "patient",
  "diagnosis",
  "diagnosed",
  "medical record",
  "prescription",
  "medication",
  "treatment plan",
  "hipaa",
  "phi",
  "date of birth",
  "insurance id",
  "medical history",
];

// Show enough to recognise the match, not the whole value.
function mask(value: string): string {
  const v = value.trim();
  if (v.length <= 6) return `${v.slice(0, 2)}…`;
  return `${v.slice(0, 4)}…${v.slice(-2)}`;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits.charAt(i));
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const PATTERNS: { kind: SensitivityKind; re: RegExp; check?: (m: string) => boolean }[] = [
  { kind: "email", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  {
    kind: "token_url",
    re: /https?:\/\/[^\s]*[?&#](?:token|key|secret|sig|signature|access_token|api_key|auth|code)=[^\s&]+/gi,
  },
  {
    kind: "secret_key",
    re: /\b(?:sk|pk|rk|xai|sb_secret|ghp|gho|ghs|github_pat|AKIA|AIza)[-_]?[A-Za-z0-9_-]{12,}/g,
  },
  { kind: "secret_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    kind: "card_number",
    re: /\b(?:\d[ -]?){13,19}\b/g,
    check: (m) => {
      const digits = m.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
    },
  },
  {
    kind: "phone",
    re: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
  },
];

export function scanForSensitiveContent(text: string): SensitivityFlag[] {
  const flags: SensitivityFlag[] = [];
  const seen = new Set<string>();
  const add = (kind: SensitivityKind, value: string) => {
    const key = `${kind}:${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    flags.push({ kind, sample: kind === "health_term" ? value : mask(value) });
  };

  for (const { kind, re, check } of PATTERNS) {
    for (const match of text.matchAll(re)) {
      if (!check || check(match[0])) add(kind, match[0]);
    }
  }
  const lower = text.toLowerCase();
  for (const term of HEALTH_TERMS) {
    const re = new RegExp(`\\b${term.replace(/ /g, "\\s+")}\\b`, "i");
    if (re.test(lower)) add("health_term", term);
  }
  return flags.slice(0, 50);
}
