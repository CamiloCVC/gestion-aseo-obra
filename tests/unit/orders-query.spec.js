import { describe, it, expect } from "vitest";
import { dayStartIso, nextDayStartIso } from "../../js/format-date.js";
import {
  applyOrderFilters,
  fetchOrdersPage,
  searchClause,
  validateDateRange,
} from "../../js/orders-query.js";

function fakeBuilder(calls = []) {
  const builder = {};
  for (const method of ["eq", "gte", "lt", "or", "order", "range", "select"]) {
    builder[method] = (...args) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  return builder;
}

describe("searchClause", () => {
  it("searches piso, contratista and comentarios case-insensitively", () => {
    expect(searchClause("torre")).toBe(
      'piso.ilike."%torre%",contratista.ilike."%torre%",comentarios.ilike."%torre%"'
    );
  });

  it("treats LIKE wildcards typed by the user as literals", () => {
    expect(searchClause("50%_")).toContain('"%50\\\\%\\\\_%"');
  });

  it("keeps PostgREST reserved characters inside the quoted value", () => {
    const clause = searchClause('a,b(c)"d');
    expect(clause).toContain('piso.ilike."%a,b(c)\\"d%"');
  });
});

describe("applyOrderFilters", () => {
  it("adds nothing when there are no filters", () => {
    const calls = [];
    applyOrderFilters(fakeBuilder(calls), {});
    expect(calls).toEqual([]);
  });

  it("combines every filter", () => {
    const calls = [];
    applyOrderFilters(fakeBuilder(calls), {
      search: "torre",
      empleadoId: "u1",
      obraId: "o1",
      desde: "2026-03-01",
      hasta: "2026-03-31",
    });
    expect(calls).toEqual([
      ["eq", "creado_por_id", "u1"],
      ["eq", "obra_id", "o1"],
      ["gte", "fecha_hora", dayStartIso("2026-03-01")],
      ["lt", "fecha_hora", nextDayStartIso("2026-03-31")],
      ["or", searchClause("torre")],
    ]);
  });

  it("supports an open-ended range with only hasta", () => {
    const calls = [];
    applyOrderFilters(fakeBuilder(calls), { hasta: "2026-03-31" });
    expect(calls).toEqual([["lt", "fecha_hora", nextDayStartIso("2026-03-31")]]);
  });

  it("ignores a whitespace-only search", () => {
    const calls = [];
    applyOrderFilters(fakeBuilder(calls), { search: "   " });
    expect(calls).toEqual([]);
  });
});

describe("validateDateRange", () => {
  it("accepts empty and single-sided ranges", () => {
    expect(validateDateRange({})).toBeNull();
    expect(validateDateRange({ desde: "2026-03-01" })).toBeNull();
    expect(validateDateRange({ hasta: "2026-03-01" })).toBeNull();
  });

  it("accepts desde equal to hasta", () => {
    expect(validateDateRange({ desde: "2026-03-01", hasta: "2026-03-01" })).toBeNull();
  });

  it("rejects desde after hasta", () => {
    expect(validateDateRange({ desde: "2026-03-02", hasta: "2026-03-01" })).toMatch(/desde/i);
  });
});

describe("fetchOrdersPage", () => {
  function fakeClient(responses) {
    const log = [];
    const queue = [...responses];
    return {
      log,
      from: () => {
        const builder = fakeBuilder(log);
        builder.select = (columns, options) => {
          log.push(["select", columns, options]);
          return builder;
        };
        builder.then = (resolve) => resolve(queue.shift());
        return builder;
      },
    };
  }

  it("requests one page ordered by created_at then id with an exact count", async () => {
    const client = fakeClient([{ data: [{ id: 1 }], error: null, count: 40 }]);
    const result = await fetchOrdersPage(client, { select: "*", filters: {}, page: 2 });

    expect(client.log).toContainEqual(["select", "*", { count: "exact" }]);
    expect(client.log).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(client.log).toContainEqual(["order", "id", { ascending: false }]);
    expect(client.log).toContainEqual(["range", 15, 29]);
    expect(result).toMatchObject({ data: [{ id: 1 }], count: 40, page: 2 });
  });

  it("recovers from an out-of-range page by counting and retrying the last page", async () => {
    const client = fakeClient([
      { data: null, error: { code: "PGRST103" } },
      { data: null, error: null, count: 20 },
      { data: [{ id: 9 }], error: null, count: 20 },
    ]);
    const result = await fetchOrdersPage(client, { select: "*", filters: {}, page: 5 });

    expect(client.log).toContainEqual(["select", "id", { count: "exact", head: true }]);
    expect(client.log).toContainEqual(["range", 15, 29]);
    expect(result).toMatchObject({ count: 20, page: 2, error: null });
  });

  it("returns other errors untouched", async () => {
    const client = fakeClient([{ data: null, error: { code: "42501", message: "denied" } }]);
    const result = await fetchOrdersPage(client, { select: "*", filters: {}, page: 1 });
    expect(result.error.message).toBe("denied");
  });
});
