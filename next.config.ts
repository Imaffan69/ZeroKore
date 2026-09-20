import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * The skills API reads markdown from `.claude/skills/**` at request time.
   * Dot-directories are not traced by default, so they must be listed
   * explicitly or the routes would find an empty directory once deployed.
   */
  outputFileTracingIncludes: {
    "/api/skills": ["./.claude/skills/**/*"],
    "/api/skills/[name]": ["./.claude/skills/**/*"],
  },
  /**
   * Baseline response hardening. HSTS is added by the platform; these cover the
   * headers it does not set. No Content-Security-Policy is declared here: the
   * Monaco editor loads blob workers and inline styles, so a CSP must be
   * introduced as Report-Only and verified against /projects first rather than
   * risked blind in production.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  /**
   * Browsers request `/favicon.ico` even when a `<link rel="icon">` is
   * declared. Serving the SVG mark there keeps that request from 404-ing
   * without shipping a second, binary copy of the same artwork.
   */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
};

export default nextConfig;
