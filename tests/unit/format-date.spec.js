import { describe, it, expect } from "vitest";
import {
  colombiaDay,
  colombiaNowInputValue,
  dayStartIso,
  formatDateTime,
  nextDayStartIso,
  toColombiaIso,
} from "../../js/format-date.js";

describe("formatDateTime", () => {
  it("shows Colombia time in 24h", () => {
    expect(formatDateTime("2026-09-24T16:25:00+00:00")).toBe("2026-09-24 11:25");
    expect(formatDateTime("2026-09-24T23:30:00+00:00")).toBe("2026-09-24 18:30");
  });

  it("shows midnight as 00:00, not 24:00", () => {
    expect(formatDateTime("2026-09-25T05:00:00+00:00")).toBe("2026-09-25 00:00");
  });

  it("crosses to the previous day when UTC is early morning", () => {
    expect(formatDateTime("2026-09-25T02:15:00+00:00")).toBe("2026-09-24 21:15");
  });

  it("returns an empty string for missing values and the raw text for invalid ones", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime("no-es-fecha")).toBe("no-es-fecha");
  });
});

describe("toColombiaIso", () => {
  it("adds the Colombia offset to a datetime-local value", () => {
    expect(toColombiaIso("2026-09-24T11:25")).toBe("2026-09-24T11:25:00-05:00");
  });

  it("keeps seconds when present", () => {
    expect(toColombiaIso("2026-09-24T11:25:30")).toBe("2026-09-24T11:25:30-05:00");
  });

  it("round-trips with formatDateTime", () => {
    expect(formatDateTime(toColombiaIso("2026-09-24T07:17"))).toBe("2026-09-24 07:17");
  });
});

describe("Colombia day helpers", () => {
  it("computes the current Colombia day near UTC midnight", () => {
    expect(colombiaDay(new Date("2026-09-25T03:00:00Z"))).toBe("2026-09-24");
  });

  it("builds the default datetime-local value in Colombia time", () => {
    expect(colombiaNowInputValue(new Date("2026-09-25T03:05:00Z"))).toBe("2026-09-24T22:05");
  });

  it("starts a day at Colombia midnight", () => {
    expect(dayStartIso("2026-03-31")).toBe("2026-03-31T05:00:00.000Z");
  });

  it("ends an inclusive day at the next Colombia midnight", () => {
    expect(nextDayStartIso("2026-03-31")).toBe("2026-04-01T05:00:00.000Z");
    expect(nextDayStartIso("2026-12-31")).toBe("2027-01-01T05:00:00.000Z");
  });
});
