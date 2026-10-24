import { z } from "zod";

import { isIsoDate } from "@/lib/dates";
import { parseMoneyToMinor } from "@/lib/money";

// Form inputs arrive as strings; empty optional fields become null for the database.

export const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `Enter ${label}`).max(max, `Use ${max} characters or fewer`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer`)
    .transform((v) => (v === "" ? null : v));

export const optionalUuid = z
  .string()
  .trim()
  .refine((v) => v === "" || z.uuid().safeParse(v).success, "Choose a valid option")
  .transform((v) => (v === "" ? null : v));

export const optionalHttpsUrl = (max = 2000) =>
  optionalText(max).refine((v) => v === null || /^https:\/\/[^\s/]+\.[^\s]+$/.test(v), {
    message: "Use a full link starting with https://",
  });

export const optionalDriveUrl = optionalText(2000).refine(
  (v) => v === null || /^https:\/\/(drive|docs)\.google\.com\/\S*$/.test(v),
  { message: "Use a Google Drive link (https://drive.google.com/… or https://docs.google.com/…)" },
);

export const isoDate = z.string().refine(isIsoDate, "Choose a valid date");

export const optionalIsoDate = z
  .string()
  .refine((v) => v === "" || isIsoDate(v), "Choose a valid date")
  .transform((v) => (v === "" ? null : v));

export const optionalMoney = z
  .string()
  .refine((v) => parseMoneyToMinor(v) !== undefined, "Enter an amount like 12500 or 12,500.50")
  .transform((v) => parseMoneyToMinor(v) ?? null);
