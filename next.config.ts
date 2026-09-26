import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / filesystem-dependent packages are loaded from node_modules at runtime.
  serverExternalPackages: ["pdfkit", "@libsql/client", "libsql", "nodemailer"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }, // 5 MB uploads + form overhead
  },
};

export default nextConfig;
