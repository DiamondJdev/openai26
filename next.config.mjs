/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Native modules must not be bundled by the Next.js server compiler.
  serverExternalPackages: ["better-sqlite3", "sharp"],
  // Investigation traces stream via SSE; keep responses uncompressed for low latency.
  poweredByHeader: false,
};

export default nextConfig;
