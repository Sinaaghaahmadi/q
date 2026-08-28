/**
 * The origin this deployment is reachable at, for absolute URLs in metadata.
 *
 * `NEXT_PUBLIC_APP_URL` wins when set — it is the only one that can name a
 * custom domain. Otherwise Vercel's own variables answer it: the stable
 * production host first, then the per-deployment host so preview builds
 * describe themselves rather than the production site. Falling back to
 * localhost is correct only for local development, where it is also true.
 */
export function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? null;
  if (vercelHost) return `https://${vercelHost}`;

  return "http://localhost:3000";
}
