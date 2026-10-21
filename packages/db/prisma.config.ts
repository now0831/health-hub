import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// 루트의 .env 를 읽는다 (모노레포 전체가 하나의 .env 를 공유)
const rootEnv = new URL("../../.env", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
