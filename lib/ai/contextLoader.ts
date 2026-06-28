import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

const CONTEXT_DIR = path.join(process.cwd(), "ai-context");

// Module-level cache — values written once per server process, never evicted.
// Key format: "filename:__raw__" for raw file text, "filename:sectionName" for parsed sections.
const cache: Record<string, string> = {};

// The full set of context files surfaced by the admin editor (/admin/context).
// COUNCIL.txt holds the Council persona/verdict/synthesis prompts that used to
// be hardcoded in TS.
export const CONTEXT_FILES = [
  "PLATFORM.txt",
  "DRIVES.txt",
  "RESPONSE_GUIDE.txt",
  "INITIATIVES.txt",
  "COMPANION_PHILOSOPHY.txt",
  "BUSINESS_AI_PHILOSOPHY.txt",
  "CONSULT_LISTENER.txt",
  "COUNCIL.txt",
] as const;

export function listContextFiles(): string[] {
  return [...CONTEXT_FILES];
}

// Drops every cache key for one file (raw + any parsed sections), so the next
// read re-pulls from fs or the just-written override. Called after an admin save.
export function clearFileCache(filename: string): void {
  for (const key of Object.keys(cache)) {
    if (key === `${filename}:__raw__` || key.startsWith(`${filename}:`)) {
      delete cache[key];
    }
  }
}

// Seed the cache with an override immediately so the instance that just saved
// reflects the edit without waiting for the TTL warm. Other instances pick it up
// via warmContextOverrides() within the TTL.
export function primeFileCache(filename: string, body: string): void {
  clearFileCache(filename);
  cache[`${filename}:__raw__`] = body;
}

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
 * Returns the full raw text of any file in ai-context/.
 * For files that do not use [SECTION:] blocks (e.g. COMPANION_PHILOSOPHY.txt).
 * Uses the same module-level cache as all other loaders.
 */
export function loadRawFile(filename: string): string {
  return readRaw(filename);
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

// ─── DB override layer ──────────────────────────────────────────────────────────
// Admins edit context from /admin/context; edits land in AiContextFile (shared by
// localhost + production via the same DATABASE_URL). warmContextOverrides() injects
// those rows into the cache above so the sync loaders (readRaw/loadSection/…) prefer
// them over the bundled files — keeping the whole loader API synchronous.
//
// ponytail: 60s TTL refetch; add Redis pub/sub invalidation only if a minute's lag
// ever matters. Edits the admin makes are reflected instantly for them because the
// save route calls clearFileCache() directly.

const CONTEXT_OVERRIDE_TTL_MS = 60_000;
let lastWarmAt = 0;

export async function warmContextOverrides(): Promise<void> {
  const now = Date.now();
  if (now - lastWarmAt < CONTEXT_OVERRIDE_TTL_MS) return;
  lastWarmAt = now;
  try {
    // Raw SQL: AiContextFile is a new model not yet in the generated client.
    const rows = await db.$queryRaw<{ fileName: string; body: string }[]>`
      SELECT "fileName", "body" FROM "AiContextFile"`;
    for (const { fileName, body } of rows) {
      // Only re-seed if the override text differs from what's cached, so we don't
      // needlessly drop parsed-section keys every cycle.
      if (cache[`${fileName}:__raw__`] !== body) {
        clearFileCache(fileName);
        cache[`${fileName}:__raw__`] = body;
      }
    }
  } catch (err) {
    // DB unreachable / table missing (pre-migration) — fall back to bundled files.
    console.warn("[contextLoader] warmContextOverrides failed:", (err as Error).message);
  }
}
