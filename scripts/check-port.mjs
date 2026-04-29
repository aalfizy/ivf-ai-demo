#!/usr/bin/env node
/**
 * Pre-flight check for the dev / start server.
 *
 * Next.js silently auto-increments the port when the requested one is
 * busy (3000 → 3001 → 3002 …). That breaks our "always on
 * http://localhost:3000" contract: the app moves around between sessions,
 * `.env` rules that depend on the URL drift, and ElevenLabs / browser
 * caches end up scattered across ports.
 *
 * This script fails fast if port 3000 is already in use and prints a
 * platform-aware instruction for freeing it. If the port is free, it
 * exits 0 and the chained `next dev -p 3000` / `next start -p 3000`
 * call takes over.
 *
 * Detection strategy:
 *   1. Try to TCP-connect to localhost:PORT. Successful connect ⇒ in use
 *      (this catches the Windows quirk where you can rebind 0.0.0.0:N
 *      while 127.0.0.1:N is already held).
 *   2. As a safety net, also try to bind a server on 127.0.0.1:PORT.
 *      EADDRINUSE ⇒ in use. Anything else ⇒ free.
 *
 * Override (rare — when 3000 truly is impossible for one run):
 *   PORT=4000 npm run dev
 */
import net from "node:net";
import os from "node:os";

const PORT = Number(process.env.PORT ?? 3000);

(async () => {
  if (await isInUse(PORT)) {
    printBusyError(PORT);
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => {
  console.error(`[port-check] Unexpected failure while probing port ${PORT}:`, err);
  process.exit(1);
});

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isInUse(port) {
  return new Promise((resolve) => {
    // ── Attempt 1: TCP connect probe ────────────────────────────────────
    const probe = net.createConnection({ host: "127.0.0.1", port, timeout: 800 });

    let settled = false;
    const settle = (busy) => {
      if (settled) return;
      settled = true;
      try { probe.destroy(); } catch { /* ignore */ }
      if (busy) return resolve(true);
      // ── Attempt 2: bind probe (covers the case where nothing answers
      //   yet on 127.0.0.1 but the slot is reserved). ─────────────────
      const server = net.createServer();
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") return resolve(true);
        // Anything else: assume free; we'll let Next surface the issue.
        resolve(false);
      });
      server.once("listening", () => server.close(() => resolve(false)));
      server.listen(port, "127.0.0.1");
    };

    probe.once("connect", () => settle(true));
    probe.once("timeout", () => settle(false));
    probe.once("error", (err) => {
      // ECONNREFUSED → nothing is listening → free
      // EHOSTUNREACH / ENETUNREACH → unlikely on localhost; treat as free
      if (err.code === "ECONNREFUSED" || err.code === "EHOSTUNREACH") {
        return settle(false);
      }
      settle(false);
    });
  });
}

function printBusyError(port) {
  const platform = os.platform();
  const RED = "\x1b[31m";
  const YELLOW = "\x1b[33m";
  const BOLD = "\x1b[1m";
  const RESET = "\x1b[0m";

  console.error("");
  console.error(`${RED}${BOLD}✖ Port ${port} is already in use.${RESET}`);
  console.error(
    `${YELLOW}Another process is bound to localhost:${port}. Free it before starting the dev server.${RESET}`
  );
  console.error("");
  console.error(`${BOLD}To free it:${RESET}`);

  if (platform === "win32") {
    console.error(
      `  ${BOLD}Windows (PowerShell):${RESET}\n` +
        `    Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }\n` +
        `  ${BOLD}One-liner:${RESET}\n` +
        `    npx kill-port ${port}`
    );
  } else {
    console.error(
      `  ${BOLD}macOS / Linux:${RESET}\n` +
        `    lsof -ti :${port} | xargs kill -9\n` +
        `  ${BOLD}One-liner:${RESET}\n` +
        `    npx kill-port ${port}`
    );
  }

  console.error("");
  console.error(
    `${YELLOW}If you really need a different port for this run only:${RESET}`
  );
  console.error(`    PORT=4000 npm run dev`);
  console.error("");
}
