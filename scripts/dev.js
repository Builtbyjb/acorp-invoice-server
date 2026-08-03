import { spawn, execSync } from "node:child_process";

const subprocess1 = spawn("docker", ["compose", "up", "-d"]);
const subprocess2 = spawn("npx", ["wrangler", "dev", "--env", "dev"]);

subprocess1.stdout.on("data", (data) => {
    console.log(data.toString());
});

subprocess1.stderr.on("data", (data) => {
    console.log(data.toString());
});

subprocess2.stdout.on("data", (data) => {
    console.log(data.toString());
});

subprocess2.stderr.on("data", (data) => {
    console.log(data.toString());
});

process.on("SIGINT", () => {
    console.log("Clean up");
    execSync("docker compose down");
});
