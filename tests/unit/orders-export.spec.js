import { describe, it, expect } from "vitest";
import { ORDER_COLUMNS, collectOrders, fetchAllOrders } from "../../js/orders-export.js";

describe("fetchAllOrders", () => {
  const rows = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i }));

  it("keeps fetching batches until a short one arrives", async () => {
    const calls = [];
    const fetchBatch = async (from, to) => {
      calls.push([from, to]);
      return from === 0 ? rows(1, 3) : from === 3 ? rows(4, 6) : rows(7, 7);
    };
    const result = await fetchAllOrders(fetchBatch, 3);

    expect(calls).toEqual([[0, 2], [3, 5], [6, 8]]);
    expect(result.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("stops after a full batch followed by an empty one", async () => {
    const fetchBatch = async (from) => (from === 0 ? rows(1, 3) : []);
    expect(await fetchAllOrders(fetchBatch, 3)).toHaveLength(3);
  });

  it("drops rows repeated across batches", async () => {
    const fetchBatch = async (from) => (from === 0 ? rows(1, 3) : rows(3, 4));
    const result = await fetchAllOrders(fetchBatch, 3);
    expect(result.map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });

  it("propagates a batch failure instead of returning a partial list", async () => {
    const fetchBatch = async () => {
      throw new Error("red caída");
    };
    await expect(fetchAllOrders(fetchBatch, 3)).rejects.toThrow("red caída");
  });
});

describe("ORDER_COLUMNS", () => {
  const order = {
    id: "abc",
    fecha_hora: "2026-03-31T19:05:00+00:00",
    obras: { nombre: "Torre Norte" },
    piso: "Piso 3",
    contratista: "ACME",
    profiles: { nombre: "Ana", email: "ana@example.com" },
    fotos_antes: ["a", "b"],
    fotos_despues: [],
    comentarios: "=cmd",
  };
  const byHeader = Object.fromEntries(ORDER_COLUMNS.map((c) => [c.header, c.value(order)]));

  it("formats the date in local time without seconds", () => {
    expect(byHeader["Fecha/hora"]).toBe("2026-03-31 14:05");
  });

  it("counts photos and derives the status", () => {
    expect(byHeader["Fotos antes"]).toBe(2);
    expect(byHeader["Fotos después"]).toBe(0);
    expect(byHeader["Estado"]).toBe("Pendiente");
  });

  it("marks an order with after photos as complete", () => {
    const done = ORDER_COLUMNS.find((c) => c.header === "Estado").value({
      ...order,
      fotos_despues: ["x"],
    });
    expect(done).toBe("Completa");
  });

  it("tolerates missing relations", () => {
    const bare = { ...order, obras: null, profiles: null, fotos_antes: null, fotos_despues: null };
    const values = Object.fromEntries(ORDER_COLUMNS.map((c) => [c.header, c.value(bare)]));
    expect(values["Obra"]).toBe("");
    expect(values["Creado por"]).toBe("");
    expect(values["Fotos antes"]).toBe(0);
  });
});

describe("collectOrders", () => {
  function fakeClient(responses) {
    const log = [];
    const queue = [...responses];
    return {
      log,
      from: () => {
        const builder = {};
        for (const method of ["eq", "gte", "lt", "or", "order", "range", "limit", "lte"]) {
          builder[method] = (...args) => (log.push([method, ...args]), builder);
        }
        builder.select = (columns, options) => (log.push(["select", columns, options]), builder);
        builder.then = (resolve) => resolve(queue.shift());
        return builder;
      },
    };
  }

  it("returns nothing when no order matches", async () => {
    const client = fakeClient([{ data: [], error: null, count: 0 }]);
    expect(await collectOrders(client, {})).toEqual({ rows: [], total: 0 });
  });

  it("cuts the export at the newest server created_at and returns the exact total", async () => {
    const cutoff = "2026-09-24T22:44:49.123456+00:00";
    const client = fakeClient([
      { data: [{ created_at: cutoff }], error: null, count: 2 },
      { data: [{ id: "b" }, { id: "a" }], error: null },
    ]);
    const result = await collectOrders(client, { obraId: "o1" });

    expect(client.log).toContainEqual(["lte", "created_at", cutoff]);
    expect(client.log).toContainEqual(["eq", "obra_id", "o1"]);
    expect(result).toEqual({ rows: [{ id: "b" }, { id: "a" }], total: 2 });
  });

  it("fails loudly when a batch errors", async () => {
    const client = fakeClient([
      { data: [{ created_at: "2026-09-24T00:00:00+00:00" }], error: null, count: 1 },
      { data: null, error: { message: "boom" } },
    ]);
    await expect(collectOrders(client, {})).rejects.toThrow("boom");
  });
});
