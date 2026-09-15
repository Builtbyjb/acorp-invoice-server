import { execSync } from "child_process";

try {
    execSync("npx drizzle-kit generate");
    execSync("npx drizzle-kit migrate --config=./drizzle.config.ts");
    execSync("npx drizzle-kit migrate --config=./drizzle.custom.config.ts");
} catch (error) {
    console.log(error);
}
