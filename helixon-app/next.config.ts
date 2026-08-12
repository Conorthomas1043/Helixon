import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (and the pdfjs-dist it wraps internally) must NOT be bundled
  // by Turbopack for server code. When bundled, pdfjs-dist's worker file
  // (pdf.worker.mjs) gets resolved relative to the .next build output
  // instead of node_modules, causing:
  //   "Setting up fake worker failed: Cannot find module '...pdf.worker.mjs'"
  // Marking it external forces Node's native module resolution, which finds
  // the worker file correctly inside node_modules/pdfjs-dist.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;