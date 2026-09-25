import { describe, it, expect } from "vitest";
import { csvCell, toCsv, csvFilename } from "../../js/csv.js";

describe("csvCell", () => {
  it("leaves plain text untouched", () => {
    expect(csvCell("Torre A")).toBe("Torre A");
  });

  it("renders null and undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes values containing the separator", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
  });

  it("doubles quotes and wraps the value", () => {
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
  });

  it("quotes values with line breaks", () => {
    expect(csvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });

  it("keeps accents and ñ", () => {
    expect(csvCell("Ñandú ácido")).toBe("Ñandú ácido");
  });

  it.each(["=1+1", "+cmd", "-cmd", "@SUM(A1)", "\tcmd", "\rcmd"])(
    "neutralises formula injection for %j",
    (value) => {
      expect(csvCell(value).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
    }
  );

  it("does not alter real numbers", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(3)).toBe("3");
  });
});

describe("toCsv", () => {
  const columns = [
    { header: "Piso", value: (row) => row.piso },
    { header: "Fotos", value: (row) => row.fotos },
  ];

  it("starts with a BOM, uses ; and CRLF", () => {
    const csv = toCsv(columns, [{ piso: "1", fotos: 2 }]);
    expect(csv).toBe("﻿Piso;Fotos\r\n1;2");
  });

  it("emits only the header when there are no rows", () => {
    expect(toCsv(columns, [])).toBe("﻿Piso;Fotos");
  });
});

describe("csvFilename", () => {
  const today = new Date("2026-09-24T15:00:00Z");

  it("uses today when there is no date filter", () => {
    expect(csvFilename({}, today)).toBe("ordenes_2026-09-24.csv");
  });

  it("uses the selected period", () => {
    expect(csvFilename({ desde: "2026-03-01", hasta: "2026-03-31" }, today)).toBe(
      "ordenes_2026-03-01_2026-03-31.csv"
    );
  });

  it("falls back to inicio/hoy for an open-ended range", () => {
    expect(csvFilename({ desde: "2026-03-01" }, today)).toBe("ordenes_2026-03-01_hoy.csv");
    expect(csvFilename({ hasta: "2026-03-31" }, today)).toBe("ordenes_inicio_2026-03-31.csv");
  });
});
