import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const production = process.argv.includes("--production");
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

const processes = [
  spawn(process.execPath, [nextBin, production ? "start" : "dev", "-p", "3000"], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, ["--env-file-if-exists=.env", join(root, "server", "app.mjs")], { cwd: root, stdio: "inherit" }),
];

function stop() {
  for (const child of processes) child.kill();
}

process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stop();
      process.exit(code);
    }
  });
}
