import { describe, it, expect } from "vitest";
import { computeTargetDimensions } from "../../js/image-compression.js";

describe("computeTargetDimensions", () => {
  it("keeps the size unchanged when already within bounds", () => {
    expect(computeTargetDimensions(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });

  it("scales down a landscape image to fit the max dimension", () => {
    expect(computeTargetDimensions(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
  });

  it("scales down a portrait image to fit the max dimension", () => {
    expect(computeTargetDimensions(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 });
  });

  it("treats an image exactly at the max dimension as already in bounds", () => {
    expect(computeTargetDimensions(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 });
  });
});
