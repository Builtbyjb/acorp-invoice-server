import { execSync } from "child_process";

execSync("npx drizzle-kit generate");
execSync("npx drizzle-kit migrate --config=./drizzle.config.ts");
execSync("npx drizzle-kit migrate --config=./drizzle.custom.config.ts");
