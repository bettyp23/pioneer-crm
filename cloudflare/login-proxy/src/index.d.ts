export const APP_MOUNT: string;
export const UPSTREAM_ORIGIN: string;
export const PAGES_ORIGIN: string;
export const PUBLIC_APEX_HOST: string;
export const PUBLIC_WWW_HOST: string;

export function isLoginMountPath(pathname: string): boolean;
export function assertUpstream(origin: string): string;
export function relativizeLocation(
  location: string,
  requestUrl: string,
  knownOrigins: string[],
): string;
export function scopeSetCookie(cookie: string): string;
export function handleLoginProxy(
  request: Request,
  env?: { UPSTREAM_ORIGIN?: string },
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<Response>;

declare const worker: {
  fetch(request: Request, env?: { UPSTREAM_ORIGIN?: string }): Promise<Response>;
};
export default worker;
