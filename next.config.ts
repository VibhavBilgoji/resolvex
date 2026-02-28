import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  serverExternalPackages: ["@supabase/ssr"],

  // Ensure @maptiler/sdk and maplibre-gl are transpiled by Next.js/Webpack so
  // that their ESM-only code works correctly in both development (Turbopack)
  // and production (Webpack) builds on Vercel.
  transpilePackages: ["@maptiler/sdk", "maplibre-gl"],

  // Silence the "multiple lockfiles / workspace root" warning that Turbopack
  // emits when it can't infer the project root unambiguously.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
