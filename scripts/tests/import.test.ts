import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clean,
  describe as describeError,
  main,
  newCleanCounts,
  processText,
  processXlsx,
  readXlsx,
  splitTitle,
  toCsv,
} from "../import.ts";

// All test data is synthetic. Never copy anything from a real BAFzA dump into this file.

// ---------------------------------------------------------------------------
// Helpers: build minimal XLSX files (ZIP + XML) in memory
// ---------------------------------------------------------------------------

function zip(files: Record<string, string>, method = 8): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content, "utf8");
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc32(raw), 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);

    parts.push(local, nameBuf, data);
    central.push(entry, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(central.length / 2, 8);
  eocd.writeUInt16LE(central.length / 2, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, eocd]);
}

type XlsxOptions = {
  sharedStrings?: string[];
  target?: string;
  method?: number;
  omit?: string[];
};

// `sheetData` is the raw XML inside <sheetData>, shared strings are raw <si> contents.
function xlsxFiles(sheetData: string, options: XlsxOptions = {}): Record<string, string> {
  const { sharedStrings = [], target = "worksheets/sheet1.xml", omit = [] } = options;
  const files: Record<string, string> = {
    "xl/workbook.xml":
      '<workbook xmlns:r="r"><sheets><sheet name="Tabelle1" sheetId="2" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Type="worksheet" Target="${target}"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheetData}</sheetData></worksheet>`,
    "xl/sharedStrings.xml": `<sst>${sharedStrings.map((s) => `<si>${s}</si>`).join("")}</sst>`,
  };
  for (const name of omit) delete files[name];
  return files;
}

function xlsx(sheetData: string, options: XlsxOptions = {}): Buffer {
  return zip(xlsxFiles(sheetData, options), options.method);
}

// A table with the columns of the WDB export, using inline strings.
function exportTable(records: [id: number, title: string, inhalt: string][]): Buffer {
  const cell = (ref: string, text: string) =>
    `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
  const header = `<row r="1">${cell("A1", "id")}${cell("B1", "dokumenttitel")}${cell("C1", "inhalt")}</row>`;
  const rows = records.map(
    ([id, title, inhalt], i) =>
      `<row r="${i + 2}"><c r="A${i + 2}"><v>${id}</v></c>${cell(`B${i + 2}`, title)}${cell(`C${i + 2}`, inhalt)}</row>`,
  );
  return xlsx(header + rows.join(""));
}

class ExitError extends Error {
  constructor(code: number | string | null | undefined) {
    super(`process.exit(${code})`);
  }
}

let log: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function allOutput(): string {
  return [...log.mock.calls, ...error.mock.calls].flat().join("\n");
}

// ---------------------------------------------------------------------------
// clean()
// ---------------------------------------------------------------------------

describe("clean", () => {
  it("removes a leading BOM", () => {
    const counts = newCleanCounts();
    expect(clean("﻿abc", counts)).toBe("abc");
    expect(counts.bom).toBe(1);
  });

  it("keeps a BOM that is not at the start", () => {
    expect(clean("a﻿b")).toBe("a﻿b");
  });

  it("normalizes \\r\\n and \\r to \\n", () => {
    const counts = newCleanCounts();
    expect(clean("a\r\nb\rc\nd", counts)).toBe("a\nb\nc\nd");
    expect(counts.lineEndings).toBe(2);
  });

  it.each([
    ["Ã¤", "ä"],
    ["Ã¶", "ö"],
    ["Ã¼", "ü"],
    ["Ã„", "Ä"],
    ["Ã–", "Ö"],
    ["Ãœ", "Ü"],
    ["ÃŸ", "ß"],
    ["â€ž", "„"],
    ["â€œ", "“"],
    ["â€“", "–"],
    ["Â ", " "],
  ])("repairs mojibake %j to %j", (broken, fixed) => {
    const counts = newCleanCounts();
    expect(clean(`x${broken}y`, counts)).toBe(`x${fixed}y`);
    expect(counts.mojibake).toBe(1);
  });

  it("repairs mojibake in a whole sentence", () => {
    expect(clean("FrÃ¼he FÃ¶rderung")).toBe("Frühe Förderung");
  });

  it("does not repair a sequence that only appears after another repair", () => {
    // "Ã" + "â€ž" becomes "Ã" + "„", which looks like the mojibake for "Ä" but must stay.
    expect(clean("Ãâ€ž")).toBe("Ã„");
  });

  it("normalizes to NFC and counts the characters saved", () => {
    const counts = newCleanCounts();
    expect(clean("Mütter", counts)).toBe("Mütter");
    expect(counts.nfc).toBe(1);
  });

  it("removes control characters but keeps \\n and \\t", () => {
    const counts = newCleanCounts();
    expect(clean("a\u0000b\u0007c\u000Bd\u001Fe\u007Ff\n\tg", counts)).toBe("abcdef\n\tg");
    expect(counts.controlChars).toBe(5);
  });

  it("removes trailing spaces and tabs on every line", () => {
    const counts = newCleanCounts();
    expect(clean("a  \nb\t\nc \t\n d", counts)).toBe("a\nb\nc\n d");
    expect(counts.trailingWhitespace).toBe(3);
  });

  it("accumulates counts over several calls", () => {
    const counts = newCleanCounts();
    clean("a \n", counts);
    clean("b \r\n", counts);
    expect(counts).toEqual({ ...newCleanCounts(), lineEndings: 1, trailingWhitespace: 2 });
  });

  it("works without a counts object", () => {
    expect(clean("ok ")).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// splitTitle() and toCsv()
// ---------------------------------------------------------------------------

describe("splitTitle", () => {
  it("splits into Leistung and Lebensumstand", () => {
    expect(splitTitle("Elterngeld: Testfall")).toEqual(["Elterngeld", "Testfall"]);
  });

  it("splits at the first colon only", () => {
    expect(splitTitle("Leistung A: Variante: Testfall")).toEqual([
      "Leistung A",
      "Variante: Testfall",
    ]);
  });

  it("uses the whole title as Leistung when there is no colon", () => {
    expect(splitTitle(" Leistung ohne Doppelpunkt ")).toEqual(["Leistung ohne Doppelpunkt", ""]);
  });
});

describe("toCsv", () => {
  it("writes a BOM, semicolons, quoted fields and CRLF rows", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toBe('﻿"a";"b"\r\n"1";"2"\r\n');
  });

  it("escapes quotes and keeps line breaks and semicolons inside fields", () => {
    expect(toCsv([['say "hi"', "x;y\nz"]])).toBe('﻿"say ""hi""";"x;y\nz"\r\n');
  });
});

// ---------------------------------------------------------------------------
// readXlsx()
// ---------------------------------------------------------------------------

describe("readXlsx", () => {
  it("reads shared strings, inline strings and numbers", () => {
    const buf = xlsx(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>inline</t></is></c><c r="C1"><v>42</v></c></row>',
      { sharedStrings: ["<t>shared</t>"] },
    );
    expect(readXlsx(buf)).toEqual([["shared", "inline", "42"]]);
  });

  it("joins rich text runs and drops phonetic hints", () => {
    const buf = xlsx('<row r="1"><c r="A1" t="s"><v>0</v></c></row>', {
      sharedStrings: [
        '<r><t>fett</t></r><r><t xml:space="preserve"> normal</t></r><rPh><t>hint</t></rPh>',
      ],
    });
    expect(readXlsx(buf)).toEqual([["fett normal"]]);
  });

  it("decodes XML entities and Excel escapes", () => {
    const buf = xlsx('<row r="1"><c r="A1" t="s"><v>0</v></c></row>', {
      sharedStrings: [
        "<t>&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos; &#228; &#xFC; &unknown; x_x000D_y _x005F_x000D_</t>",
      ],
    });
    expect(readXlsx(buf)).toEqual([["<a> & \"b\" 'c' ä ü &unknown; x\ry _x000D_"]]);
  });

  it("fills gaps between cells and skips empty rows", () => {
    const buf = xlsx(
      '<row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row><row r="2"/><row r="3"><c r="AA3"><v>x</v></c></row>',
    );
    const rows = readXlsx(buf);
    expect(rows[0]).toEqual(["1", "", "3"]);
    expect(rows[1]).toEqual([]);
    expect(rows[2]?.[26]).toBe("x");
  });

  it("handles cells without a reference, empty cells and unknown shared string indexes", () => {
    const buf = xlsx('<row r="1"><c><v>a</v></c><c r="B1"/><c r="C1" t="s"><v>99</v></c></row>');
    expect(readXlsx(buf)).toEqual([["a", "", ""]]);
  });

  it("works without shared strings", () => {
    const buf = xlsx('<row r="1"><c r="A1"><v>1</v></c></row>', { omit: ["xl/sharedStrings.xml"] });
    expect(readXlsx(buf)).toEqual([["1"]]);
  });

  it("reads uncompressed (stored) ZIP entries", () => {
    const buf = xlsx('<row r="1"><c r="A1"><v>1</v></c></row>', { method: 0 });
    expect(readXlsx(buf)).toEqual([["1"]]);
  });

  it("resolves an absolute worksheet path", () => {
    const buf = xlsx('<row r="1"><c r="A1"><v>1</v></c></row>', {
      target: "/xl/worksheets/sheet1.xml",
    });
    expect(readXlsx(buf)).toEqual([["1"]]);
  });

  it.each([
    [
      "not a ZIP file",
      () => Buffer.from("not a zip file at all, just some text"),
      "Error: input is not a valid XLSX file (not a ZIP)",
    ],
    [
      "a corrupt ZIP directory",
      () => {
        const buf = xlsx("");
        buf.writeUInt32LE(0, buf.readUInt32LE(buf.length - 22 + 16));
        return buf;
      },
      "Error: ZIP directory is corrupt",
    ],
    [
      "an unsupported compression",
      () => xlsx("", { method: 12 }),
      "Error: unsupported ZIP compression",
    ],
    [
      "no workbook",
      () => xlsx("", { omit: ["xl/workbook.xml"] }),
      "Error: no worksheet found in XLSX file",
    ],
    [
      "no worksheet file",
      () => xlsx("", { omit: ["xl/worksheets/sheet1.xml"] }),
      "Error: worksheet missing in XLSX file",
    ],
  ])("exits with code 1 for %s", (_, input, message) => {
    expect(() => readXlsx(input())).toThrow(new ExitError(1));
    expect(error).toHaveBeenCalledWith(message);
  });
});

// ---------------------------------------------------------------------------
// processXlsx() and processText()
// ---------------------------------------------------------------------------

describe("processXlsx", () => {
  it("adds Leistung and Lebensumstand after dokumenttitel and cleans every cell", () => {
    const csv = processXlsx(
      exportTable([
        [1, "Leistung A: Testfall eins ", "Text\r\nmit FÃ¶rderung "],
        [2, "Leistung B: Variante: Testfall", "Text"],
        [3, "Ohne Doppelpunkt", ""],
      ]),
    );
    expect(csv).toBe(
      toCsv([
        ["id", "dokumenttitel", "Leistung", "Lebensumstand", "inhalt"],
        ["1", "Leistung A: Testfall eins", "Leistung A", "Testfall eins", "Text\nmit Förderung"],
        ["2", "Leistung B: Variante: Testfall", "Leistung B", "Variante: Testfall", "Text"],
        ["3", "Ohne Doppelpunkt", "Ohne Doppelpunkt", "", ""],
      ]),
    );
    expect(log).toHaveBeenCalledWith(
      "clean: bom=0 lineEndings=1 mojibake=1 nfc=0 controlChars=0 trailingWhitespace=2",
    );
    expect(log).toHaveBeenCalledWith(
      "records: records=3 titleWithoutColon=1 titleMultipleColons=1",
    );
  });

  it("handles a file with only a header row", () => {
    expect(processXlsx(exportTable([]))).toBe(
      toCsv([["id", "dokumenttitel", "Leistung", "Lebensumstand", "inhalt"]]),
    );
  });

  it.each([
    ["id", '<row r="1"><c r="A1" t="inlineStr"><is><t>dokumenttitel</t></is></c></row>'],
    ["dokumenttitel", '<row r="1"><c r="A1" t="inlineStr"><is><t>id</t></is></c></row>'],
    ["a header row", ""],
  ])("exits with code 1 when %s is missing", (_, sheetData) => {
    expect(() => processXlsx(xlsx(sheetData))).toThrow(new ExitError(1));
    expect(error).toHaveBeenCalledWith(
      "Error: expected columns 'id' and 'dokumenttitel' in header row",
    );
  });
});

describe("processText", () => {
  it("cleans raw text and logs the counts", () => {
    expect(processText("﻿a \r\nb")).toBe("a\nb");
    expect(log).toHaveBeenCalledWith(
      "clean: bom=1 lineEndings=1 mojibake=0 nfc=0 controlChars=0 trailingWhitespace=1",
    );
  });
});

describe("describe", () => {
  it("returns the error code of system errors", () => {
    expect(describeError(Object.assign(new Error("secret content"), { code: "ENOENT" }))).toBe(
      "ENOENT",
    );
  });

  it("returns the error name, never the message", () => {
    expect(describeError(new RangeError("secret content"))).toBe("RangeError");
  });

  it("handles values that are not errors", () => {
    expect(describeError("secret content")).toBe("unknown error");
  });
});

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------

describe("main", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "import-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("converts an XLSX file to CSV", async () => {
    const input = path.join(dir, "export.xlsx");
    const output = path.join(dir, "out", "result.csv");
    await writeFile(input, exportTable([[7, "Leistung: Testfall", "Inhalt"]]));

    await main(["--input", input, "--output", output]);

    expect(await readFile(output, "utf8")).toBe(
      toCsv([
        ["id", "dokumenttitel", "Leistung", "Lebensumstand", "inhalt"],
        ["7", "Leistung: Testfall", "Leistung", "Testfall", "Inhalt"],
      ]),
    );
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^read: .*export\.xlsx \(\d+ bytes\)$/));
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^written: .*result\.csv \(\d+ chars\)$/),
    );
  });

  it("cleans other files as raw text", async () => {
    const input = path.join(dir, "export.xml");
    const output = path.join(dir, "export.clean.xml");
    await writeFile(input, "﻿<a>FrÃ¼he FÃ¶rderung\u0007</a>  \r\n");

    await main(["--input", input, "--output", output]);

    expect(await readFile(output, "utf8")).toBe("<a>Frühe Förderung</a>\n");
  });

  it("writes to resources/dump/out/<name>.clean.csv by default", async () => {
    const name = `import-test-${process.pid}-${Date.now()}`;
    const input = path.join(dir, `${name}.xlsx`);
    const expected = path.resolve(
      import.meta.dirname,
      "../../resources/dump/out",
      `${name}.clean.csv`,
    );
    await writeFile(input, exportTable([]));

    try {
      await main(["--input", input]);
      expect(await readFile(expected, "utf8")).toContain("Lebensumstand");
    } finally {
      await rm(expected, { force: true });
    }
  });

  it("never logs data contents", async () => {
    const input = path.join(dir, "export.xlsx");
    await writeFile(input, exportTable([[1, "GEHEIM-TITEL: GEHEIM-UMSTAND", "GEHEIM-INHALT"]]));

    await main(["--input", input, "--output", path.join(dir, "out.csv")]);

    expect(allOutput()).not.toMatch(/GEHEIM/);
  });

  it.each([
    ["no arguments", []],
    ["no --input", ["--output", "x.csv"]],
    ["an unknown option", ["--input", "x.xlsx", "--unknown"]],
  ])("exits with code 2 and the usage for %s", async (_, args) => {
    await expect(main(args)).rejects.toThrow(new ExitError(2));
    expect(error).toHaveBeenCalledWith(
      "Usage: node scripts/import.ts --input <path> [--output <path>]",
    );
  });

  it("exits with code 1 when the input cannot be read", async () => {
    const input = path.join(dir, "missing.xlsx");
    await expect(main(["--input", input])).rejects.toThrow(new ExitError(1));
    expect(error).toHaveBeenCalledWith(`Error reading ${input}: ENOENT`);
  });

  it("exits with code 1 when the output cannot be written", async () => {
    const input = path.join(dir, "export.txt");
    const output = path.join(dir, "export.txt", "out.txt"); // parent is a file, not a directory
    await writeFile(input, "GEHEIM-INHALT");

    await expect(main(["--input", input, "--output", output])).rejects.toThrow(new ExitError(1));
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^Error writing ${output.replaceAll("\\", "\\\\")}: E[A-Z]+$`),
      ),
    );
    expect(allOutput()).not.toMatch(/GEHEIM/);
  });
});
