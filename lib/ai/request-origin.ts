/** Compare the browser origin with the externally addressed HTTP host.
 * Next's internal request URL can use localhost for a 127.0.0.1 request.
 * A deployment proxy may terminate HTTPS, hence its forwarded protocol.
 */
export function isSameOrigin(
  origin: string | null,
  host: string | null,
  protocol: string,
): boolean {
  if (!origin) return true;
  const scheme = protocol.replace(/:$/, "");
  if (!host || (scheme !== "http" && scheme !== "https")) return false;
  try {
    const supplied = new URL(origin);
    const expected = new URL(`${scheme}://${host}`);
    return origin === supplied.origin && supplied.origin === expected.origin;
  } catch {
    return false;
  }
}
