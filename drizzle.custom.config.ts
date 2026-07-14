import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/* Custom drizzle config for the custom migrations */
export default defineConfig({
    out: "./drizzle/custom",
    schema: "./src/db/schema.ts",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
