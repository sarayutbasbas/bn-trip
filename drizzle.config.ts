import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema:"./db/schema.ts", out:"./db/migrations", dialect:"postgresql", dbCredentials:{ url:process.env.DATABASE_URL ?? "postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip" } });
