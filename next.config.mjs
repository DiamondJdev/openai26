import { requireDeploymentEnv } from "./lib/config/deployment-env.ts";

requireDeploymentEnv(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sharp is used only for temporary still-image processing.
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/*": ["./fixtures/**/*"],
  },
  // Investigation traces stream via SSE; keep responses uncompressed for low latency.
  poweredByHeader: false,
};

export default nextConfig;
