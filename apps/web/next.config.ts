import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// 루트의 .env 를 읽는다 (모노레포 전체가 하나의 .env 를 공유)
const rootEnv = new URL("../../.env", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 모노레포 내부 패키지는 빌드 없이 TypeScript 소스를 그대로 가져다 쓴다
  transpilePackages: ["@health/shared", "@health/ingest", "@health/db", "@health/coach"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
