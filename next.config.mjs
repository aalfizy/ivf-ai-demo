import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Single source of truth for the build's identity. `lib/version.ts`
 * re-exports these env vars as a typed module so all UI code can
 * import a stable, build-stamped version object.
 *
 *   APP_VERSION   ← package.json "version" (bump on every release/rollback)
 *   BUILD_DATE    ← ISO timestamp captured at build/start time
 *   GIT_COMMIT    ← short HEAD sha when available, else "local"
 *   BUILD_CHANNEL ← "release" | "rollback" | "dev" (override via env)
 */
function safeGit(args) {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const APP_VERSION = pkg.version;
const BUILD_DATE = new Date().toISOString();
const GIT_COMMIT = safeGit("rev-parse --short HEAD") || "local";
const BUILD_CHANNEL =
  process.env.BUILD_CHANNEL?.trim() ||
  (process.env.NODE_ENV === "production" ? "release" : "dev");

console.log(
  `[Build] Zorrya AI v${APP_VERSION}  commit=${GIT_COMMIT}  channel=${BUILD_CHANNEL}  date=${BUILD_DATE}`
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_BUILD_DATE: BUILD_DATE,
    NEXT_PUBLIC_GIT_COMMIT: GIT_COMMIT,
    NEXT_PUBLIC_BUILD_CHANNEL: BUILD_CHANNEL,
  },
};

export default nextConfig;
