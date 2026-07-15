import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: { url: process.env.DATABASE_URI! },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/db/schema.ts"
});
