import fs from "node:fs";
import path from "node:path";

export interface SystemLog {
  id: string;
  timestamp: string;
  level: "error" | "warn" | "info";
  source: string;
  message: string;
  phone?: string;
  payload?: unknown;
  details?: unknown;
  stack?: string;
}

function getLogsFilePath(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      const logsDir = path.join(dir, ".data");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      return path.join(logsDir, "system-logs.jsonl");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fallback = path.join(process.cwd(), ".data");
  if (!fs.existsSync(fallback)) {
    fs.mkdirSync(fallback, { recursive: true });
  }
  return path.join(fallback, "system-logs.jsonl");
}

const memoryLogs: SystemLog[] = [];

export async function addSystemLog(
  log: Omit<SystemLog, "id" | "timestamp">
): Promise<SystemLog> {
  const entry: SystemLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...log,
  };

  memoryLogs.unshift(entry);
  if (memoryLogs.length > 500) {
    memoryLogs.length = 500;
  }

  try {
    const filePath = getLogsFilePath();
    const line = JSON.stringify(entry) + "\n";
    await fs.promises.appendFile(filePath, line, "utf8");
  } catch (err) {
    console.error("[addSystemLog] Erro ao gravar log:", err);
  }

  return entry;
}

export async function getSystemLogs(limit = 200): Promise<SystemLog[]> {
  try {
    const filePath = getLogsFilePath();
    if (!fs.existsSync(filePath)) {
      return memoryLogs.slice(0, limit);
    }
    const content = await fs.promises.readFile(filePath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const parsed: SystemLog[] = [];
    for (let i = lines.length - 1; i >= 0 && parsed.length < limit; i--) {
      try {
        parsed.push(JSON.parse(lines[i]));
      } catch {}
    }
    return parsed;
  } catch {
    return memoryLogs.slice(0, limit);
  }
}

export async function clearSystemLogs(): Promise<void> {
  memoryLogs.length = 0;
  try {
    const filePath = getLogsFilePath();
    if (fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, "", "utf8");
    }
  } catch (err) {
    console.error("[clearSystemLogs] Erro ao limpar arquivo:", err);
  }
}
