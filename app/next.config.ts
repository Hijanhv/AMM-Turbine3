import type { NextConfig } from "next";
import path from "node:path";

// Vercel's auto-deploy clones the whole repo and runs the build inside
// `app/` (our rootDirectory). Vercel's post-build then expects the Next.js
// output one directory up — at `/vercel/path0/.next/` — but Next defaults
// to writing into `app/.next/`. When VERCEL=1, redirect the output (and
// the file-tracing root) one directory up so they agree.
const onVercel = process.env.VERCEL === "1";
const parent = path.resolve(process.cwd(), "..");

const nextConfig: NextConfig = onVercel
  ? {
      outputFileTracingRoot: parent,
      distDir: path.join(parent, ".next"),
    }
  : {};

export default nextConfig;
