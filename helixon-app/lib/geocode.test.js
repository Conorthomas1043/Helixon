import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const { boundingBox, distanceMiles, isPlaceless, normaliseLocation } = await import("./geocode");

describe("geocode helpers", () => {
  it("normalises locations", () => {
    expect(normaliseLocation("Leeds, West Yorkshire, UK")).toBe("leeds, west yorkshire");
    expect(normaliseLocation("London (Hybrid)")).toBe("london");
    expect(isPlaceless("remote")).toBe(true);
    expect(isPlaceless("leeds")).toBe(false);
  });

  it("measures distance", () => {
    const leeds = { lat: 53.8008, lng: -1.5491 };
    const york = { lat: 53.959, lng: -1.0815 };
    expect(Math.round(distanceMiles(leeds, york))).toBe(22);
  });

  it("boxes a radius", () => {
    const box = boundingBox({ lat: 53.8, lng: -1.55 }, 25);
    expect(box.maxLat - box.minLat).toBeCloseTo(0.723, 2);
    expect(box.maxLng - box.minLng).toBeGreaterThan(box.maxLat - box.minLat);
  });
});
