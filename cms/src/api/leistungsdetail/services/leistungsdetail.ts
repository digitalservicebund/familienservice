/**
 * leistungsdetail service
 *
 * importAll(): validates a whole BAFzA dump, resolves the Familienleistungen and upserts
 * all entries by bafzaId in ONE transaction. Any problem aborts the whole import before
 * anything is written. Results and logs contain only counters, IDs and error codes,
 * never content.
 */

import { createHash } from "node:crypto";

import { factories } from "@strapi/strapi";
import type { Core } from "@strapi/strapi";

const UID = "api::leistungsdetail.leistungsdetail";
const LEISTUNG_UID = "api::familienleistung.familienleistung";
const QUELLE = "BAFzA WDB" as const;
const CHUNK_SIZE = 1000;

export type ImportErrorCode = "INVALID_PAYLOAD" | "INVALID_ENTRY" | "DUPLICATE_BAFZA_ID";

export type ImportError = {
  bafzaId?: string;
  index?: number;
  code: ImportErrorCode;
  field?: string;
};

export type ImportResult =
  | {
      ok: true;
      created: number;
      updated: number;
      unchanged: number;
      unassigned: number;
      rejected: 0;
      ids: { created: string[]; updated: string[]; unassigned: string[] };
    }
  | { ok: false; created: 0; updated: 0; unchanged: 0; rejected: number; errors: ImportError[] };

export type ImportService = { importAll(payload: unknown): Promise<ImportResult> };

type Entry = {
  bafzaId: string;
  // Name of the Familienleistung; null when the title could not be split (no ":").
  // Entries whose Leistung is null or unknown are still imported, just without relation.
  familienleistung: string | null;
  titel: string | null;
  quelltitel: string;
  quellinhalt: string;
  kurzfassung: string | null;
  langfassung: string | null;
  rechtsgrundlage: string | null;
  links: string | null;
  aktuelleInfos: string | null;
};

const REQUIRED_FIELDS = ["bafzaId", "quelltitel", "quellinhalt"] as const;
// Split sections are optional: the pipeline may first send only quelltitel/quellinhalt
// familienleistung/titel: optional, a missing value is logged but never blocks the import
const OPTIONAL_FIELDS = [
  "familienleistung",
  "titel",
  "kurzfassung",
  "langfassung",
  "rechtsgrundlage",
  "links",
  "aktuelleInfos",
] as const;

// leistungId = resolved documentId (or null): when a missing Leistung is created in the CMS
// later, the hash changes and the next import assigns it.
export function computeHash(e: Entry, leistungId: string | null): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        leistungId,
        e.titel,
        e.quelltitel,
        e.quellinhalt,
        e.kurzfassung,
        e.langfassung,
        e.rechtsgrundlage,
        e.links,
        e.aktuelleInfos,
      ]),
    )
    .digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chunk<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) out.push(items.slice(i, i + CHUNK_SIZE));
  return out;
}

function validate(
  payload: unknown,
): { stand: string; entries: Entry[] } | { errors: ImportError[] } {
  if (!isRecord(payload) || !Array.isArray(payload.eintraege)) {
    return { errors: [{ code: "INVALID_PAYLOAD", field: "eintraege" }] };
  }
  if (
    typeof payload.stand !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.stand) ||
    Number.isNaN(Date.parse(payload.stand))
  ) {
    return { errors: [{ code: "INVALID_PAYLOAD", field: "stand" }] };
  }

  const errors: ImportError[] = [];
  const entries: Entry[] = [];
  const seen = new Set<string>();

  payload.eintraege.forEach((raw: unknown, index: number) => {
    if (!isRecord(raw)) {
      errors.push({ index, code: "INVALID_ENTRY" });
      return;
    }
    const bafzaId = typeof raw.bafzaId === "string" ? raw.bafzaId : undefined;
    let valid = true;
    for (const field of REQUIRED_FIELDS) {
      const value = raw[field];
      if (typeof value !== "string" || value.trim() === "") {
        errors.push({ bafzaId, index, code: "INVALID_ENTRY", field });
        valid = false;
      }
    }
    // Optional fields: absent/null/empty -> null, anything else must be a string
    const optional: Record<string, string | null> = {};
    for (const field of OPTIONAL_FIELDS) {
      const value = raw[field];
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        optional[field] = null;
      } else if (typeof value === "string") {
        optional[field] = field === "familienleistung" || field === "titel" ? value.trim() : value;
      } else {
        errors.push({ bafzaId, index, code: "INVALID_ENTRY", field });
        valid = false;
      }
    }
    // bafzaId ends up in logs and responses: restrict to a safe charset (no newlines etc.)
    if (valid && !/^[A-Za-z0-9_-]{1,64}$/.test(bafzaId!)) {
      errors.push({ index, code: "INVALID_ENTRY", field: "bafzaId" });
      valid = false;
    }
    if (!valid) return;
    if (seen.has(bafzaId!)) {
      errors.push({ bafzaId, index, code: "DUPLICATE_BAFZA_ID" });
      return;
    }
    seen.add(bafzaId!);
    entries.push({
      bafzaId: bafzaId!,
      quelltitel: raw.quelltitel as string,
      quellinhalt: raw.quellinhalt as string,
      ...(optional as Pick<Entry, (typeof OPTIONAL_FIELDS)[number]>),
    });
  });

  return errors.length > 0 ? { errors } : { stand: payload.stand, entries };
}

const rejected = (errors: ImportError[]): ImportResult => ({
  ok: false,
  created: 0,
  updated: 0,
  unchanged: 0,
  rejected: new Set(errors.map((e) => e.bafzaId ?? `#${e.index}`)).size || errors.length,
  errors,
});

export default factories.createCoreService(UID, ({ strapi }: { strapi: Core.Strapi }) => ({
  async importAll(payload: unknown): Promise<ImportResult> {
    const validated = validate(payload);
    if ("errors" in validated) {
      strapi.log.warn(
        `Leistungsdetail import rejected: ${validated.errors.length} validation error(s)`,
      );
      return rejected(validated.errors);
    }
    const { stand, entries } = validated;

    // Resolve Familienleistungen by name (draft always exists, so drafts-only Leistungen resolve too)
    const names = [
      ...new Set(entries.flatMap((e) => (e.familienleistung ? [e.familienleistung] : []))),
    ];
    const leistungIdByName = new Map<string, string>();
    for (const part of chunk(names)) {
      const found = await strapi.documents(LEISTUNG_UID).findMany({
        filters: { name: { $in: part } },
        fields: ["name"],
        status: "draft",
        limit: part.length,
      });
      for (const l of found) leistungIdByName.set(l.name as string, l.documentId);
    }
    // Missing or unknown Leistung: no relation, logged below, import continues
    const leistungIdOf = (e: Entry) =>
      e.familienleistung ? (leistungIdByName.get(e.familienleistung) ?? null) : null;

    // Load existing entries for change detection
    const existing = new Map<string, { documentId: string; inhaltHash: string }>();
    for (const part of chunk(entries.map((e) => e.bafzaId))) {
      const found = await strapi.documents(UID).findMany({
        filters: { bafzaId: { $in: part } },
        fields: ["bafzaId", "inhaltHash"],
        limit: part.length,
      });
      for (const d of found)
        existing.set(d.bafzaId as string, {
          documentId: d.documentId,
          inhaltHash: d.inhaltHash as string,
        });
    }

    const created: string[] = [];
    const updated: string[] = [];
    let unchanged = 0;

    // All writes in one transaction: any failure rolls everything back
    await strapi.db.transaction(async () => {
      for (const e of entries) {
        const leistungId = leistungIdOf(e);
        const inhaltHash = computeHash(e, leistungId);
        const current = existing.get(e.bafzaId);
        if (current?.inhaltHash === inhaltHash) {
          unchanged++;
          continue;
        }
        const data = {
          bafzaId: e.bafzaId,
          // null explicitly disconnects an earlier assignment
          familienleistung: leistungId,
          titel: e.titel,
          quelltitel: e.quelltitel,
          quellinhalt: e.quellinhalt,
          kurzfassung: e.kurzfassung,
          langfassung: e.langfassung,
          rechtsgrundlage: e.rechtsgrundlage,
          links: e.links,
          aktuelleInfos: e.aktuelleInfos,
          quelle: QUELLE,
          stand,
          inhaltHash,
        };
        if (current) {
          await strapi.documents(UID).update({ documentId: current.documentId, data });
          updated.push(e.bafzaId);
        } else {
          await strapi.documents(UID).create({ data });
          created.push(e.bafzaId);
        }
      }
    });

    // Not errors: logged by ID only (no names/content), the import goes on
    const unassigned = entries.filter((e) => leistungIdOf(e) === null).map((e) => e.bafzaId);
    for (const id of unassigned)
      strapi.log.warn(`bafzaId ${id} konnte keiner Leistung zugeordnet werden`);
    for (const e of entries) {
      if (e.titel === null) strapi.log.warn(`bafzaId ${e.bafzaId} hat keinen Titel`);
    }

    strapi.log.info(
      `Leistungsdetail import done: created=${created.length} updated=${updated.length} unchanged=${unchanged} unassigned=${unassigned.length} (payload entries: ${entries.length})`,
    );
    return {
      ok: true,
      created: created.length,
      updated: updated.length,
      unchanged,
      unassigned: unassigned.length,
      rejected: 0,
      ids: { created, updated, unassigned },
    };
  },
}));
