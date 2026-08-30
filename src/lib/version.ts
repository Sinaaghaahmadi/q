/**
 * What version of Asaex is running, and when it was built.
 *
 * One constant, imported everywhere the number is shown, so the figure in the
 * menu, the figure in the footer and the figure `/api/health` reports can never
 * disagree. It is deliberately not read from `package.json` at runtime: that
 * file is not part of the client bundle, and a version the browser cannot see
 * is a version nobody looking at the app can quote back to support.
 *
 * Keep it in step with `package.json` — `scripts/check-version.mjs` fails the
 * build if the two drift.
 */
export const APP_VERSION = "1.1.0";

/**
 * The commit this build came from, when the platform supplies it.
 *
 * Vercel sets `VERCEL_GIT_COMMIT_SHA`; a self-hosted build can pass
 * `NEXT_PUBLIC_BUILD_SHA`. Absent both, builds are identified by version alone,
 * which is the honest answer rather than a fabricated hash.
 */
export const BUILD_SHA = (
  process.env.NEXT_PUBLIC_BUILD_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  ""
).slice(0, 7);

/** `1.0.0` or `1.0.0 · a1b2c3d`, in Latin digits — a version is an identifier. */
export function versionLabel(): string {
  return BUILD_SHA ? `${APP_VERSION} · ${BUILD_SHA}` : APP_VERSION;
}
