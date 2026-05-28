import fs from "fs";
import path from "path";

const CONTEXT_DIR = path.join(process.cwd(), "ai-context");

// Module-level cache — values written once per server process, never evicted.
// Key format: "filename:__raw__" for raw file text, "filename:sectionName" for parsed sections.
const cache: Record<string, string> = {};

// ─── Internal helpers ──────────────────────────────────────────────────────────

function readRaw(filename: string): string {
  const key = `${filename}:__raw__`;
  if (key in cache) return cache[key];
  try {
    const content = fs.readFileSync(path.join(CONTEXT_DIR, filename), "utf-8");
    cache[key] = content;
    return content;
  } catch (err) {
    console.warn(`[contextLoader] Could not read ${filename}:`, (err as Error).message);
    cache[key] = "";
    return "";
  }
}

function parseSections(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /\[SECTION:\s*(\w+)\]([\s\S]*?)\[\/SECTION\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    result[m[1].trim()] = m[2].trim();
  }
  return result;
}

function formatFile(filename: string): string {
  const raw = readRaw(filename);
  if (!raw.trim()) return "";
  const sections = parseSections(raw);
  return Object.entries(sections)
    .filter(([, v]) => v.length > 0)
    .map(([name, content]) => `## [${name.toUpperCase()}]\n${content}`)
    .join("\n\n");
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Concatenates all populated sections from PLATFORM.txt, DRIVES.txt, and
 * RESPONSE_GUIDE.txt. Returns empty string when all files are empty.
 */
export function loadPlatformContext(): string {
  const parts = [
    formatFile("PLATFORM.txt"),
    formatFile("DRIVES.txt"),
    formatFile("RESPONSE_GUIDE.txt"),
  ].filter(Boolean);
  return parts.join("\n\n");
}

/**
 * Returns the raw content of INITIATIVES.txt (all sections as-is).
 * Empty string when file is missing or blank.
 */
export function loadInitiativeContext(): string {
  return readRaw("INITIATIVES.txt").trim();
}

/**
 * Returns the content of a single named section from any context file.
 * Returns empty string if the file or section is missing.
 *
 * @example loadSection("DRIVES.txt", "builder")
 */
export function loadSection(filename: string, sectionName: string): string {
  const key = `${filename}:${sectionName}`;
  if (key in cache) return cache[key];
  const sections = parseSections(readRaw(filename));
  const result = sections[sectionName] ?? "";
  cache[key] = result;
  return result;
}
