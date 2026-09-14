/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenNext handles the Workers adapter; nothing Cloudflare-specific is needed here.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;

// Enable the Cloudflare bindings (env.DB, env.KV, ...) during `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
await initOpenNextCloudflareForDev();
