// Which browser origins may call the API. Pure, so it is unit tested.

/** FRONTEND_URL may hold several origins separated by commas. Whitespace and trailing slashes are ignored. */
export function parseOrigins(raw: string | undefined, fallback = "http://localhost:5173"): string[] {
  return (raw || fallback)
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Browsers send the origin without a trailing slash. A request with no Origin header (curl, server to server,
 * same-origin) is always allowed. In development any localhost / 127.0.0.1 port is allowed too, because Vite moves to
 * the next port when 5173 is busy; in production only the listed origins are.
 */
export function isOriginAllowed(origin: string | undefined, allowed: string[], isProduction: boolean): boolean {
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  return !isProduction && LOCAL_ORIGIN.test(origin);
}
