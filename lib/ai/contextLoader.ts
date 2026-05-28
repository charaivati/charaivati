import fs from "fs";
import path from "path";

const CONTEXT_DIR = path.join(process.cwd(), "ai-context");

const FILES = {
  PLATFORM:       "PLATFORM.txt",
  DRIVES:         "DRIVES.txt",
  RESPONSE_GUIDE: "RESPONSE_GUIDE.txt",
  INITIATIVES:    "INITIATIVES.txt",
} as const;

// In-memory cache — populated once per server process
const cache: Partial<Record<keyof typeof FILES, string>> = {};

function readFile(key: keyof typeof FILES): string {
  if (cache[key] !== undefined) return cache[key]!;
  try {
    const content = fs.readFileSync(path.join(CONTEXT_DIR, FILES[key]), "utf-8").trim();
    cache[key] = content;
    return content;
  } catch {
    cache[key] = "";
    return "";
  }
}

export function loadPlatformContext(): string {
  const sections: string[] = [];
  for (const key of ["PLATFORM", "DRIVES", "RESPONSE_GUIDE", "INITIATIVES"] as const) {
    const content = readFile(key);
    if (content) sections.push(`## ${key}\n${content}`);
  }
  return sections.join("\n\n");
}

export function loadInitiativeContext(): string {
  return readFile("INITIATIVES");
}
