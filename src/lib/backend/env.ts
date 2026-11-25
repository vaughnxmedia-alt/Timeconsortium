import { readFileSync } from "node:fs";
import { join } from "node:path";

let loaded = false;

function loadEnvFile() {
  if (loaded) return;
  loaded = true;
  try {
    const file = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of file.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch {
    // The host can provide these values directly.
  }
}

export function env(name: string) {
  loadEnvFile();
  return process.env[name]?.trim() ?? "";
}
