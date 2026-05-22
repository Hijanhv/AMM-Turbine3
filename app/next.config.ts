import type { NextConfig } from "next";

// `app/` lives inside a larger Anchor workspace, so Vercel's monorepo
// inference tries to guess an `outputFileTracingRoot` and crashes when its
// guess is undefined. Pin it here to silence that path.
const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
