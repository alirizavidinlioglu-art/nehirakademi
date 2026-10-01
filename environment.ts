// Only server modules consume deployment origins. Secrets stay in environment variables.
export function appOrigin(requestUrl?: string): string {
  const configured = process.env.APP_URL;
  const candidate =
    configured ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : requestUrl) ||
    "http://localhost:3000";
  const url = new URL(candidate);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (process.env.VERCEL && url.protocol !== "https:")
  ) {
    throw new Error("APP_URL geçerli bir HTTPS uygulama adresi olmalı.");
  }
  return url.origin;
}
