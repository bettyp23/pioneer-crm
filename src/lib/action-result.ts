// Result shape returned by Server Actions to client forms.
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
