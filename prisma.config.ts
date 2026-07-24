import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// CLI-only config (generate/migrate/validate/format). The runtime
// PrismaClient does not read this file — it connects via @prisma/adapter-pg
// using DATABASE_URL directly (see src/lib/db/prisma.ts). Migrations need
// the non-pooled connection, hence DIRECT_URL here.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
});
