// BAFzA import pipeline (proof of concept)
//
// Usage: node scripts/import.ts --input <path> [--output <path>]
//
// The script does not know whether it runs locally or in GitHub Actions: it reads one file
// and writes one file. Fetching the dump (manually or from S3) happens outside of it.
//
// Input formats:
// - .xlsx: BAFzA WDB export (table with columns id, dokumenttitel, inhalt, …).
//   Each row is a record with a BAFzA ID. Output is a CSV with the additional columns
//   "Leistung" and "Lebensumstand" (from "dokumenttitel" = "<Leistung>: <Lebensumstand>").
// - anything else: cleaned as raw text (fallback while the export format is not final).
//
// LOGGING RULE: logs are public. Only log counters, file paths and lengths,
// NEVER data contents or text excerpts.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { inflateRawSync } from "node:zlib";

const USAGE = "Usage: node scripts/import.ts --input <path> [--output <path>]";
const DEFAULT_OUT_DIR = path.resolve(
  import.meta.dirname,
  "../resources/dump/out",
);

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

// Typical encoding errors: UTF-8 bytes that were decoded as Windows-1252.
const MOJIBAKE: Record<string, string> = {
  "Ã¤": "ä", // Ã¤
  "Ã¶": "ö", // Ã¶
  "Ã¼": "ü", // Ã¼
  "Ã„": "Ä", // Ã„
  "Ã–": "Ö", // Ã–
  Ãœ: "Ü", // Ãœ
  ÃŸ: "ß", // ÃŸ
  "â€ž": "„", // â€ž
  "â€œ": "“", // â€œ
  "â€“": "–", // â€“ (en dash)
  "Â ": " ", // Â + non-breaking space
};
// Single pass with alternation so that one replacement cannot create a new match.
const MOJIBAKE_RE = new RegExp(Object.keys(MOJIBAKE).join("|"), "g");
// oxlint-disable-next-line no-control-regex -- matching control characters is the point: they get removed
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TRAILING_WS_RE = /[ \t]+$/gm;

type CleanCounts = Record<
  | "bom"
  | "lineEndings"
  | "mojibake"
  | "nfc"
  | "controlChars"
  | "trailingWhitespace",
  number
>;

export function newCleanCounts(): CleanCounts {
  return {
    bom: 0,
    lineEndings: 0,
    mojibake: 0,
    nfc: 0,
    controlChars: 0,
    trailingWhitespace: 0,
  };
}

function count(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0;
}

// Accumulates into `counts` so that many cells still result in ONE log line.
export function clean(
  text: string,
  counts: CleanCounts = newCleanCounts(),
): string {
  // 1. Remove BOM
  if (text.startsWith("﻿")) {
    text = text.slice(1);
    counts.bom++;
  }

  // 2. Normalize line endings
  counts.lineEndings += count(text, /\r\n?/g);
  text = text.replace(/\r\n?/g, "\n");

  // 3. Fix encoding errors
  counts.mojibake += count(text, MOJIBAKE_RE);
  text = text.replace(MOJIBAKE_RE, (m) => MOJIBAKE[m] ?? m);

  // 4. Unicode normalization (counter = characters saved by composition)
  const nfc = text.normalize("NFC");
  counts.nfc += text.length - nfc.length;
  text = nfc;

  // 5. Remove control characters except \n and \t
  counts.controlChars += count(text, CONTROL_RE);
  text = text.replace(CONTROL_RE, "");

  // 6. Remove trailing spaces/tabs (counter = affected lines)
  counts.trailingWhitespace += count(text, TRAILING_WS_RE);
  text = text.replace(TRAILING_WS_RE, "");

  return text;
}

function formatCounts(label: string, counts: Record<string, number>): string {
  return `${label}: ${Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ")}`;
}

// ---------------------------------------------------------------------------
// Read XLSX (ZIP + XML, Node built-ins only)
// ---------------------------------------------------------------------------

function fail(message: string, exitCode: number): never {
  console.error(message);
  process.exit(exitCode);
}

// Reads named files from a ZIP archive ("stored" and "deflate" only).
function unzip(buf: Buffer): (name: string) => string | undefined {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0)
    fail("Error: input is not a valid XLSX file (not a ZIP)", 1);

  const entries = new Map<
    string,
    { method: number; start: number; size: number }
  >();
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = buf.readUInt16LE(eocd + 10); i > 0; i--) {
    if (buf.readUInt32LE(p) !== 0x02014b50)
      fail("Error: ZIP directory is corrupt", 1);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    entries.set(buf.toString("utf8", p + 46, p + 46 + nameLen), {
      method: buf.readUInt16LE(p + 10),
      size: buf.readUInt32LE(p + 20),
      start:
        local +
        30 +
        buf.readUInt16LE(local + 26) +
        buf.readUInt16LE(local + 28),
    });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }

  return (name) => {
    const e = entries.get(name);
    if (!e) return undefined;
    const data = buf.subarray(e.start, e.start + e.size);
    if (e.method === 0) return data.toString("utf8");
    if (e.method === 8) return inflateRawSync(data).toString("utf8");
    fail("Error: unsupported ZIP compression", 1);
  };
}

const XML_ENTITIES: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

function xmlText(s: string): string {
  return (
    s
      .replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) =>
        e.startsWith("#x")
          ? String.fromCodePoint(parseInt(e.slice(2), 16))
          : e.startsWith("#")
            ? String.fromCodePoint(parseInt(e.slice(1), 10))
            : (XML_ENTITIES[e] ?? m),
      )
      // Excel encodes special characters like \r as _x000D_ (and a literal "_x" as _x005F_x…)
      .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
  );
}

// Text from <t> elements, without phonetic hints (<rPh>).
function runsText(xml: string): string {
  const parts = xml
    .replace(/<rPh\b[\s\S]*?<\/rPh>/g, "")
    .match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g);
  return (parts ?? [])
    .map((t) => xmlText(t.replace(/^<t[^>]*>|<\/t>$/g, "")))
    .join("");
}

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

// Returns the first worksheet as rows (row 1 = header).
export function readXlsx(buf: Buffer): string[][] {
  const read = unzip(buf);
  const workbook = read("xl/workbook.xml");
  const rels = read("xl/_rels/workbook.xml.rels");
  const relId = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const target = rels?.match(
    new RegExp(`<Relationship\\b[^>]*\\bId="${relId}"[^>]*>`),
  )?.[0];
  const sheetPath = target?.match(/\bTarget="([^"]+)"/)?.[1];
  if (!sheetPath)
    fail("Error: no worksheet found in XLSX file", 1);
  const sheet = read(
    sheetPath.startsWith("/") ? sheetPath.slice(1) : `xl/${sheetPath}`,
  );
  if (!sheet) fail("Error: worksheet missing in XLSX file", 1);

  const shared = (
    read("xl/sharedStrings.xml")?.match(/<si>[\s\S]*?<\/si>/g) ?? []
  ).map(runsText);

  const rows: string[][] = [];
  for (const [, rowBody = ""] of sheet.matchAll(
    /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g,
  )) {
    const row: string[] = [];
    for (const [, attrs = "", body = ""] of rowBody.matchAll(
      /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const value =
        type === "s"
          ? (shared[Number(v)] ?? "")
          : type === "inlineStr"
            ? runsText(body)
            : xmlText(v);
      row[ref ? columnIndex(ref) : row.length] = value;
    }
    rows.push(Array.from(row, (c) => c ?? ""));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Process records
// ---------------------------------------------------------------------------

// "Elterngeld: Selbstständige" -> ["Elterngeld", "Selbstständige"].
// Splits at the FIRST colon; without a colon the whole title is the Leistung.
export function splitTitle(title: string): [leistung: string, lebensumstand: string] {
  const i = title.indexOf(":");
  return i < 0
    ? [title.trim(), ""]
    : [title.slice(0, i).trim(), title.slice(i + 1).trim()];
}

export function toCsv(rows: string[][]): string {
  // Semicolon + BOM so that a German Excel opens the file correctly on double-click.
  const field = (v: string) => `"${v.replaceAll('"', '""')}"`;
  return "﻿" + rows.map((r) => r.map(field).join(";")).join("\r\n") + "\r\n";
}

export function processXlsx(buf: Buffer): string {
  const [header = [], ...records] = readXlsx(buf);
  const titleCol = header.indexOf("dokumenttitel");
  if (header.indexOf("id") < 0 || titleCol < 0) {
    fail(
      "Error: expected columns 'id' and 'dokumenttitel' in header row",
      1,
    );
  }

  const cleanCounts = newCleanCounts();
  const stats = {
    records: records.length,
    titleWithoutColon: 0,
    titleMultipleColons: 0,
  };
  const out = [header.toSpliced(titleCol + 1, 0, "Leistung", "Lebensumstand")];
  for (const record of records) {
    const cells = Array.from({ length: header.length }, (_, i) =>
      clean(record[i] ?? "", cleanCounts),
    );
    const title = cells[titleCol] ?? "";
    const colons = count(title, /:/g);
    if (colons === 0) stats.titleWithoutColon++;
    if (colons > 1) stats.titleMultipleColons++;
    out.push(cells.toSpliced(titleCol + 1, 0, ...splitTitle(title)));
  }

  console.log(formatCounts("clean", cleanCounts));
  console.log(formatCounts("records", stats));

  // Hook in later: b) detect changes, c) link legislation, d) vectorize,
  // e) write to the Postgres table – findable as Leistung > Lebensumstand > Langfassung
  // (inhalt); the Langfassung serves as an aid for the editorial team. Until the DB exists: CSV only.

  return toCsv(out);
}

export function processText(raw: string): string {
  const counts = newCleanCounts();
  const cleaned = clean(raw, counts);
  console.log(formatCounts("clean", counts));

  // Hook in later: b) detect changes, c) link legislation, d) vectorize

  return cleaned;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

// Only returns the error code/type, never err.message – it could contain data contents.
export function describe(err: unknown): string {
  if (err instanceof Error)
    return (err as NodeJS.ErrnoException).code ?? err.name;
  return "unknown error";
}

export async function main(
  args: string[] = process.argv.slice(2),
): Promise<void> {
  let input: string | undefined;
  let output: string | undefined;
  try {
    ({ input, output } = parseArgs({
      args,
      options: { input: { type: "string" }, output: { type: "string" } },
    }).values);
  } catch {
    fail(USAGE, 2);
  }
  if (!input) fail(USAGE, 2);

  const { name, ext } = path.parse(input);
  const isXlsx = ext.toLowerCase() === ".xlsx";
  output ??= path.join(
    DEFAULT_OUT_DIR,
    `${name}.clean${isXlsx ? ".csv" : ext}`,
  );

  let raw: Buffer;
  try {
    raw = await readFile(input);
  } catch (err) {
    fail(`Error reading ${input}: ${describe(err)}`, 1);
  }
  console.log(`read: ${input} (${raw.length} bytes)`);

  const result = isXlsx ? processXlsx(raw) : processText(raw.toString("utf8"));

  try {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, result, "utf8");
  } catch (err) {
    fail(`Error writing ${output}: ${describe(err)}`, 1);
  }
  console.log(`written: ${output} (${result.length} chars)`);
}

// Only run when executed directly (node scripts/import.ts), not when imported by the tests.
if (import.meta.main) {
  main().catch((err: unknown) => fail(`Error: ${describe(err)}`, 1));
}
