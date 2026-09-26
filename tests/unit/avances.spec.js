import { describe, it, expect } from "vitest";
import { groupAvancesByDay, uploadAvance, cleanupAvancesFor, fetchAvancePhotos } from "../../js/avances.js";

describe("groupAvancesByDay", () => {
  it("returns an empty list for no avances", () => {
    expect(groupAvancesByDay([])).toEqual([]);
  });

  it("concatenates photos from several avances on the same day, in insertion order", () => {
    const avances = [
      { created_at: "2026-09-25T13:00:00-05:00", fotos: ["a1", "a2"] },
      { created_at: "2026-09-25T18:30:00-05:00", fotos: ["a3"] },
    ];
    expect(groupAvancesByDay(avances)).toEqual([{ day: "2026-09-25", fotos: ["a1", "a2", "a3"] }]);
  });

  it("separates avances from different days into different groups", () => {
    const avances = [
      { created_at: "2026-09-24T10:00:00-05:00", fotos: ["a1"] },
      { created_at: "2026-09-25T10:00:00-05:00", fotos: ["a2"] },
    ];
    expect(groupAvancesByDay(avances)).toEqual([
      { day: "2026-09-25", fotos: ["a2"] },
      { day: "2026-09-24", fotos: ["a1"] },
    ]);
  });

  it("tolerates an avance without photos", () => {
    const avances = [{ created_at: "2026-09-25T10:00:00-05:00", fotos: null }];
    expect(groupAvancesByDay(avances)).toEqual([{ day: "2026-09-25", fotos: [] }]);
  });
});

function fakeClient({ uploadError, insertError, selectResult, deleteError } = {}) {
  const log = [];
  return {
    log,
    storage: {
      from: () => ({
        upload: async (path, file) => (log.push(["upload", path, file]), { error: uploadError ?? null }),
        remove: async (paths) => (log.push(["remove", paths]), { error: null }),
      }),
    },
    from: (table) => {
      const builder = {};
      builder.insert = async (row) => (log.push(["insert", table, row]), { error: insertError ?? null });
      builder.select = () => builder;
      builder.eq = (...args) => (log.push(["eq", ...args]), builder);
      builder.then = (resolve) => resolve(selectResult ?? { data: [], error: null });
      builder.delete = () => ({
        eq: async (...args) => (log.push(["delete-eq", ...args]), { error: deleteError ?? null }),
      });
      return builder;
    },
  };
}

const identityCompress = async (file) => file;

describe("uploadAvance", () => {
  it("compresses, uploads each file, and inserts one avance with all the paths", async () => {
    const client = fakeClient();
    const files = [{ name: "a.jpg" }, { name: "b.jpg" }];

    await uploadAvance(client, "orden-1", files, { compress: identityCompress });

    const inserts = client.log.filter(([action]) => action === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toBe("avances");
    expect(inserts[0][2].orden_id).toBe("orden-1");
    expect(inserts[0][2].fotos).toHaveLength(2);
    expect(inserts[0][2].fotos[0]).toMatch(/^ordenes\/orden-1\/avances\//);
  });

  it("rolls back uploaded files when the insert fails", async () => {
    const client = fakeClient({ insertError: { message: "insert failed" } });
    const files = [{ name: "a.jpg" }];

    await expect(uploadAvance(client, "orden-1", files, { compress: identityCompress })).rejects.toThrow(
      "insert failed"
    );

    const removed = client.log.find(([action]) => action === "remove");
    expect(removed[1]).toHaveLength(1);
  });

  it("propagates an upload error without inserting", async () => {
    const client = fakeClient({ uploadError: { message: "upload failed" } });
    const files = [{ name: "a.jpg" }];

    await expect(uploadAvance(client, "orden-1", files, { compress: identityCompress })).rejects.toThrow(
      "upload failed"
    );

    expect(client.log.some(([action]) => action === "insert")).toBe(false);
  });
});

describe("fetchAvancePhotos", () => {
  it("flattens photos across all avance rows for an order", async () => {
    const client = fakeClient({
      selectResult: { data: [{ fotos: ["a", "b"] }, { fotos: ["c"] }], error: null },
    });
    expect(await fetchAvancePhotos(client, "orden-1")).toEqual(["a", "b", "c"]);
  });
});

describe("cleanupAvancesFor", () => {
  it("removes storage files and deletes the rows", async () => {
    const client = fakeClient({
      selectResult: { data: [{ fotos: ["a", "b"] }], error: null },
    });

    const removed = await cleanupAvancesFor(client, "orden-1");

    expect(removed).toEqual(["a", "b"]);
    expect(client.log).toContainEqual(["remove", ["a", "b"]]);
    expect(client.log).toContainEqual(["delete-eq", "orden_id", "orden-1"]);
  });

  it("skips storage removal when there are no photos", async () => {
    const client = fakeClient({ selectResult: { data: [], error: null } });
    await cleanupAvancesFor(client, "orden-1");
    expect(client.log.some(([action]) => action === "remove")).toBe(false);
  });
});
