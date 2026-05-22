import type { NextConfig } from "next";
import path from "node:path";

// Without an explicit `outputFileTracingRoot`, Vercel's `modifyConfig`
// crashes with `path argument undefined` because it can't infer one. Pin
// it to the repo root (one up from this `app/` directory). Leave `distDir`
// as the default so Vercel finds the build output at `app/.next/`.
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
};

export default nextConfig;
