import { describe, it, expect } from "vitest";
import { PAGE_SIZE, pageInfo, formatCounter } from "../../js/pagination.js";

describe("pageInfo", () => {
  it("uses 15 rows per page", () => {
    expect(PAGE_SIZE).toBe(15);
  });

  it("describes the first page", () => {
    expect(pageInfo(1, 132)).toEqual({ page: 1, totalPages: 9, offset: 0, from: 1, to: 15 });
  });

  it("describes a partial last page", () => {
    expect(pageInfo(9, 132)).toEqual({ page: 9, totalPages: 9, offset: 120, from: 121, to: 132 });
  });

  it("handles a total that is an exact multiple of the page size", () => {
    expect(pageInfo(2, 30)).toEqual({ page: 2, totalPages: 2, offset: 15, from: 16, to: 30 });
  });

  it("returns an empty range when there are no results", () => {
    expect(pageInfo(1, 0)).toEqual({ page: 1, totalPages: 1, offset: 0, from: 0, to: 0 });
  });

  it("clamps a page beyond the end to the last page", () => {
    expect(pageInfo(99, 132).page).toBe(9);
  });

  it("clamps a page below 1 to the first page", () => {
    expect(pageInfo(0, 132).page).toBe(1);
  });
});

describe("formatCounter", () => {
  it("shows the visible range and the total", () => {
    expect(formatCounter(pageInfo(2, 132), 132)).toBe("16–30 de 132");
  });

  it("formats thousands with es-CO separators", () => {
    expect(formatCounter(pageInfo(1, 14332), 14332)).toBe("1–15 de 14.332");
  });

  it("shows 0 de 0 without results", () => {
    expect(formatCounter(pageInfo(1, 0), 0)).toBe("0 de 0");
  });
});
