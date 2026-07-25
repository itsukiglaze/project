import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted (Docker/VPS) deployment copies only traced files+deps into
  // .next/standalone (see Dockerfile), but "next start" (this project's
  // default `npm run start`) explicitly does not work once this is set —
  // Next.js requires "node .next/standalone/server.js" instead. Opt-in via
  // BUILD_STANDALONE so the default build/start flow is unaffected; only
  // the Docker image's build sets it. Irrelevant to Vercel, which uses its
  // own build pipeline and ignores this either way.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Deliberately NOT setting X-Frame-Options / a frame-ancestors CSP:
          // Telegram Desktop and web.telegram.org embed Mini Apps in an
          // iframe. Blocking framing would break the app for every user
          // opening it from those clients.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Only takes effect over HTTPS (browsers ignore it on plain HTTP)
          // — Telegram requires the Mini App to be served over HTTPS anyway.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
