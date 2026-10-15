import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os testes E2E usam outra pasta (.next-test) para rodar junto do `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  // Service worker do painel do admin (guia de PWA do Next).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
