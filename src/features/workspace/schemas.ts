import { z } from "zod";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Enter a workspace name").max(120, "Use 120 characters or fewer"),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone"),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const auditPageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);
