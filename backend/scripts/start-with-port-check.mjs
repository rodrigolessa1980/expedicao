import { readFileSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

function readEnvPort() {
  if (process.env.PORT) return Number(process.env.PORT);

  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf-8");
    const line = content
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.startsWith("PORT="));
    if (!line) return 3001;
    const value = Number(line.slice("PORT=".length));
    return Number.isFinite(value) ? value : 3001;
  } catch {
    return 3001;
  }
}

function getPidsOnPort(port) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano -p tcp | findstr :${port}`, {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf-8"
      });
      const pids = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s+/).at(-1))
        .filter(Boolean);
      return [...new Set(pids)];
    }

    const output = execSync(`lsof -ti tcp:${port}`, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8"
    });
    return output
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === "win32") {
    execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    return;
  }
  execSync(`kill -9 ${pid}`, { stdio: "ignore" });
}

function killProcessesOnPort(port) {
  const pids = getPidsOnPort(port);
  for (const pid of pids) {
    try {
      killPid(pid);
      console.log(`Processo ${pid} encerrado na porta ${port}.`);
    } catch {
      console.log(`Falha ao encerrar PID ${pid} na porta ${port}.`);
    }
  }
}

function startBackend() {
  const port = readEnvPort();
  killProcessesOnPort(port);

  const args = process.argv.includes("--watch") ? ["--watch", "src/index.js"] : ["src/index.js"];
  const child = spawn("node", args, {
    stdio: "inherit",
    shell: true
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

startBackend();
