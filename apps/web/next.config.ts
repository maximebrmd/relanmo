import { config } from "@relanmo/next-config";

const nextConfig = {
  ...config,
  output: "export" as const,
};

export default nextConfig;
