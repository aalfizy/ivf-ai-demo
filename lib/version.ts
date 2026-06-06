/**
 * Single import surface for the app's build identity.
 *
 * The underlying values are injected at build time by `next.config.mjs`
 * (from `package.json` + the local git checkout) and exposed to the
 * browser bundle via `NEXT_PUBLIC_*` env vars. UI code should ONLY
 * read version info through this module — never through
 * `process.env.NEXT_PUBLIC_…` directly — so we have one place to evolve
 * the contract.
 *
 * Why everything is read from env (not from a JSON import):
 *   1. Importing `package.json` would pull all dependency metadata into
 *      the client bundle.
 *   2. Env-injection lets us stamp commit hash + build date without any
 *      file regeneration step.
 */

export type BuildChannel = "release" | "rollback" | "dev" | string;

export interface VersionInfo {
  /** Semver, sourced from package.json "version". */
  version: string;
  /** ISO timestamp captured when the build / dev server started. */
  buildDate: string;
  /** Short git SHA of HEAD at build time, or "local" if unavailable. */
  commit: string;
  /** Release channel — "release", "rollback", or "dev". */
  channel: BuildChannel;
  /** Pre-formatted display label, e.g. "Zorrya AI v1.0.1". */
  label: string;
}

const RAW_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const RAW_BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";
const RAW_COMMIT = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "local";
const RAW_CHANNEL = (process.env.NEXT_PUBLIC_BUILD_CHANNEL ?? "dev") as BuildChannel;

export const VERSION_INFO: VersionInfo = {
  version: RAW_VERSION,
  buildDate: RAW_BUILD_DATE,
  commit: RAW_COMMIT,
  channel: RAW_CHANNEL,
  label: `Zorrya AI v${RAW_VERSION}`,
};

/** Compact one-line build descriptor for logs / tooltips. */
export function buildDescriptor(): string {
  const date = formatBuildDate(VERSION_INFO.buildDate);
  return [
    VERSION_INFO.label,
    `commit ${VERSION_INFO.commit}`,
    `built ${date}`,
    `channel ${VERSION_INFO.channel}`,
  ].join(" · ");
}

/** Human-friendly UTC date+time, falls back to the raw ISO if parsing fails. */
export function formatBuildDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Stable yyyy-mm-dd HH:MM UTC formatting (no locale drift).
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}
