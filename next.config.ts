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
   * Browsers request `/favicon.ico` even when a `<link rel="icon">` is
   * declared. Serving the SVG mark there keeps that request from 404-ing
   * without shipping a second, binary copy of the same artwork.
   */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
};

export default nextConfig;
