import { describe, it, expect } from "vitest";
import { previousMonthRange } from "../../supabase/functions/cleanup-evidencias/range.js";

describe("previousMonthRange", () => {
  it("returns October 2026 in Colombia time when run on Nov 15", () => {
    const { from, to } = previousMonthRange(new Date("2026-11-15T05:00:00Z"));
    expect(from.toISOString()).toBe("2026-10-01T05:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("wraps to December of the previous year when run in January", () => {
    const { from, to } = previousMonthRange(new Date("2027-01-15T05:00:00Z"));
    expect(from.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });

  it("uses the Colombia date, not UTC, near midnight", () => {
    // 2026-12-01 03:00 UTC is still Nov 30 in Colombia → previous month is October
    const { from } = previousMonthRange(new Date("2026-12-01T03:00:00Z"));
    expect(from.toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });
});
