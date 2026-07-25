/**
 * Runs once when a new server instance starts (`next dev` / `next start`),
 * before any request is handled — the one place a missing required
 * environment variable can fail loudly at boot instead of silently
 * surfacing as a 500 on whichever request happens to touch it first.
 *
 * Does NOT run during `next build`, `vitest`, or the Prisma CLI (those are
 * separate processes), so it never blocks CI/build pipelines that don't
 * have runtime secrets configured.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (process.env.NODE_ENV === "production" && !process.env.TELEGRAM_BOT_TOKEN) {
    missing.push("TELEGRAM_BOT_TOKEN");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. See .env.example.`,
    );
  }
}
