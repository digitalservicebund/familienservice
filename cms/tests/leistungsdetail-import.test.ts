import type { Core } from "@strapi/strapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import serviceFactory, { computeHash } from "../src/api/leistungsdetail/services/leistungsdetail";

// Only the custom service methods are under test: the factory returns them as-is, so
// the real Strapi core (which needs a booted instance) is not loaded.
vi.mock("@strapi/strapi", () => ({
  factories: { createCoreService: (_uid: string, cfg: unknown) => cfg },
}));

type Row = { documentId: string; bafzaId: string; inhaltHash: string };

const entry = (bafzaId: string, overrides: Record<string, unknown> = {}) => ({
  bafzaId,
  familienleistung: "Elternzeit",
  titel: "Auswirkungen",
  quelltitel: "Elternzeit: Auswirkungen",
  quellinhalt: "Quelltext",
  ...overrides,
});

function setup(existing: Row[] = [], leistungen = [{ documentId: "L1", name: "Elternzeit" }]) {
  const create = vi.fn(async () => ({}));
  const update = vi.fn(async () => ({}));
  const transaction = vi.fn(async (fn: () => Promise<void>) => fn());
  const strapi = {
    log: { info: vi.fn(), warn: vi.fn() },
    db: { transaction },
    documents: (uid: string) =>
      uid === "api::familienleistung.familienleistung"
        ? { findMany: vi.fn(async () => leistungen) }
        : { findMany: vi.fn(async () => existing), create, update },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = (serviceFactory as any)({ strapi: strapi as unknown as Core.Strapi });
  return { service, strapi, create, update, transaction };
}

let payload: { stand: string; eintraege: ReturnType<typeof entry>[] };
beforeEach(() => {
  payload = { stand: "2026-11-20", eintraege: [entry("1"), entry("2")] };
});

describe("importAll", () => {
  it("creates new entries in one transaction", async () => {
    const { service, create, transaction } = setup();
    const result = await service.importAll(payload);
    expect(result).toMatchObject({ ok: true, created: 2, updated: 0, unchanged: 0 });
    expect(transaction).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data).toMatchObject({
      familienleistung: "L1",
      quelle: "BAFzA WDB",
      stand: "2026-11-20",
    });
  });

  it("reports unchanged on re-import of the same content", async () => {
    const existing = payload.eintraege.map((e, i) => ({
      documentId: `D${i}`,
      bafzaId: e.bafzaId,
      inhaltHash: computeHash(e, "L1"),
    }));
    const { service, create, update } = setup(existing);
    const result = await service.importAll(payload);
    expect(result).toMatchObject({ ok: true, created: 0, updated: 0, unchanged: 2 });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("updates an entry with the same bafzaId when content changed", async () => {
    const { service, update, create } = setup([
      { documentId: "D1", bafzaId: "1", inhaltHash: "old" },
    ]);
    const result = await service.importAll(payload);
    expect(result).toMatchObject({ ok: true, created: 1, updated: 1 });
    expect(update.mock.calls[0][0].documentId).toBe("D1");
    expect(create).toHaveBeenCalledOnce();
  });

  it("treats an unknown Familienleistung like a missing one: imports unassigned and logs, no abort", async () => {
    payload.eintraege.push(entry("3", { familienleistung: "Unbekannt" }));
    const { service, strapi, create } = setup();
    const result = await service.importAll(payload);
    expect(result).toMatchObject({
      ok: true,
      created: 3,
      unassigned: 1,
      ids: { unassigned: ["3"] },
    });
    expect(create.mock.calls[2][0].data.familienleistung).toBeNull();
    expect(strapi.log.warn).toHaveBeenCalledWith(
      "bafzaId 3 konnte keiner Leistung zugeordnet werden",
    );
  });

  it("assigns the Leistung on a later import once it exists", async () => {
    const e = entry("1", { familienleistung: "Neu" });
    const stale = { documentId: "D1", bafzaId: "1", inhaltHash: computeHash(e as never, null) };
    const { service, update } = setup([stale], [{ documentId: "L2", name: "Neu" }]);
    const result = await service.importAll({ stand: "2026-11-20", eintraege: [e] });
    expect(result).toMatchObject({ ok: true, updated: 1, unassigned: 0 });
    expect(update.mock.calls[0][0].data.familienleistung).toBe("L2");
  });

  it("imports entries without titel and logs their bafzaId", async () => {
    const { service, strapi } = setup();
    const result = await service.importAll({
      stand: "2026-11-20",
      eintraege: [entry("4", { titel: undefined })],
    });
    expect(result).toMatchObject({ ok: true, created: 1, unassigned: 0 });
    expect(strapi.log.warn).toHaveBeenCalledWith("bafzaId 4 hat keinen Titel");
  });

  it("rejects duplicate bafzaIds and missing fields", async () => {
    payload.eintraege = [entry("1"), entry("1"), entry("2", { quelltitel: "" })];
    const { service, create } = setup();
    const result = await service.importAll(payload);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      errors: [
        { bafzaId: "1", code: "DUPLICATE_BAFZA_ID" },
        { bafzaId: "2", code: "INVALID_ENTRY", field: "quelltitel" },
      ],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([null, {}, { stand: "2026-11-20" }, { stand: "20.11.2026", eintraege: [] }])(
    "rejects invalid payload %j",
    async (bad) => {
      const { service } = setup();
      expect(await service.importAll(bad)).toMatchObject({
        ok: false,
        errors: [{ code: "INVALID_PAYLOAD" }],
      });
    },
  );

  it("stores quellinhalt and sets absent split sections to null", async () => {
    const { service, create } = setup();
    const ok = await service.importAll({
      stand: "2026-11-20",
      eintraege: [entry("1", { links: "" })],
    });
    expect(ok).toMatchObject({ ok: true, created: 1 });
    expect(create.mock.calls[0][0].data).toMatchObject({
      quellinhalt: "Quelltext",
      kurzfassung: null,
      langfassung: null,
      rechtsgrundlage: null,
      links: null,
      aktuelleInfos: null,
    });
  });

  it("accepts split sections when sent", async () => {
    const { service, create } = setup();
    await service.importAll({
      stand: "2026-11-20",
      eintraege: [entry("1", { kurzfassung: "Kurz", langfassung: "Lang" })],
    });
    expect(create.mock.calls[0][0].data).toMatchObject({
      kurzfassung: "Kurz",
      langfassung: "Lang",
    });
  });

  it("imports entries without Leistung unassigned, logs their bafzaId and does not abort", async () => {
    payload.eintraege.push(entry("3", { familienleistung: undefined, titel: null }));
    const { service, strapi, create } = setup();
    const result = await service.importAll(payload);
    expect(result).toMatchObject({
      ok: true,
      created: 3,
      unassigned: 1,
      ids: { unassigned: ["3"] },
    });
    expect(create.mock.calls[2][0].data).toMatchObject({
      bafzaId: "3",
      familienleistung: null,
      titel: null,
    });
    expect(strapi.log.warn).toHaveBeenCalledWith(
      "bafzaId 3 konnte keiner Leistung zugeordnet werden",
    );
  });

  it("disconnects the Leistung when an existing entry becomes unassigned", async () => {
    const { service, update } = setup([{ documentId: "D3", bafzaId: "3", inhaltHash: "old" }]);
    await service.importAll({
      stand: "2026-11-20",
      eintraege: [entry("3", { familienleistung: undefined, titel: undefined })],
    });
    expect(update.mock.calls[0][0].data.familienleistung).toBeNull();
  });

  it("rejects a bafzaId with unsafe characters (log injection)", async () => {
    const { service, strapi } = setup();
    const bad = await service.importAll({
      stand: "2026-11-20",
      eintraege: [entry("1\nFAKE LOG LINE")],
    });
    expect(bad).toMatchObject({ ok: false, errors: [{ index: 0, field: "bafzaId" }] });
    expect(JSON.stringify(strapi.log.warn.mock.calls)).not.toContain("FAKE");
  });

  it("requires quellinhalt", async () => {
    const { service } = setup();
    const bad = await service.importAll({
      stand: "2026-11-20",
      eintraege: [entry("2", { quellinhalt: "" })],
    });
    expect(bad).toMatchObject({ ok: false, errors: [{ bafzaId: "2", field: "quellinhalt" }] });
  });

  it("rejects non-string optional sections", async () => {
    const { service } = setup();
    const result = await service.importAll({
      stand: "2026-11-20",
      eintraege: [entry("1", { links: ["a"] })],
    });
    expect(result).toMatchObject({ ok: false, errors: [{ field: "links" }] });
  });

  it("changes the hash when any section changes", () => {
    const base = { ...entry("1"), aktuelleInfos: null } as never;
    const h = computeHash(base, "L1");
    expect(computeHash({ ...(base as object), aktuelleInfos: "x" } as never, "L1")).not.toBe(h);
    expect(computeHash({ ...(base as object), links: "y" } as never, "L1")).not.toBe(h);
    expect(computeHash(base, null)).not.toBe(h);
  });

  it("logs only counters and IDs, never content", async () => {
    payload.eintraege[0].quellinhalt = "GEHEIMER-INHALT";
    const { service, strapi } = setup();
    await service.importAll(payload);
    const logged = JSON.stringify([...strapi.log.info.mock.calls, ...strapi.log.warn.mock.calls]);
    expect(logged).not.toContain("GEHEIMER-INHALT");
  });
});
