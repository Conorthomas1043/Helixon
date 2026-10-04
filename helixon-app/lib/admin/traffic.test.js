import { describe, expect, it } from "vitest";
import { aggregateTrafficRows, blockedShare, decodePlace, geoPointFromRow, placeLabel, rangeHours } from "./traffic";

describe("decodePlace", () => {
  it("decodes URL-encoded city names from the Vercel header", () => {
    expect(decodePlace("Frankfurt%20am%20Main")).toBe("Frankfurt am Main");
    expect(decodePlace("S%C3%A3o%20Paulo")).toBe("São Paulo");
  });

  it("leaves plain and malformed values alone", () => {
    expect(decodePlace("London")).toBe("London");
    expect(decodePlace("100%")).toBe("100%");
    expect(decodePlace("")).toBe(null);
  });
});

describe("geoPointFromRow", () => {
  it("maps a database row to a map point", () => {
    expect(geoPointFromRow({ country: "DE", city: "Frankfurt%20am%20Main", lat: 50.1, lon: 8.7, requests: "4652", blocked: "2", unique_ips: "12" })).toEqual({
      city: "Frankfurt am Main", country: "DE", lat: 50.1, lon: 8.7, count: 4652, blocked: 2, uniqueIps: 12,
    });
  });
});

describe("aggregateTrafficRows", () => {
  it("groups nearby coordinates in the same city and totals the range", () => {
    const rows = [
      { ip: "1.1.1.1", country: "DE", city: "Frankfurt%20am%20Main", lat: 50.11552, lon: 8.68417, blocked: false },
      { ip: "1.1.1.2", country: "DE", city: "Frankfurt%20am%20Main", lat: 50.1169, lon: 8.6837, blocked: true },
      { ip: "2.2.2.2", country: "GB", city: "London", lat: 51.5085, lon: -0.1257, blocked: false },
      { ip: "3.3.3.3", country: "US", city: null, lat: null, lon: null, blocked: false },
    ];
    const { points, summary } = aggregateTrafficRows(rows);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ city: "Frankfurt am Main", count: 2, blocked: 1, uniqueIps: 2, lat: 50.1, lon: 8.7 });
    expect(summary).toEqual({ requests: 4, blocked: 1, uniqueIps: 4, geolocated: 3, countries: 3 });
  });
});

describe("helpers", () => {
  it("computes blocked share and labels", () => {
    expect(blockedShare({ count: 4, blocked: 1 })).toBe(0.25);
    expect(blockedShare({ count: 0, blocked: 0 })).toBe(0);
    expect(placeLabel({ city: "Bristol", country: "GB" })).toBe("Bristol, GB");
    expect(placeLabel({})).toBe("Unknown location");
    expect(rangeHours("7d")).toBe(168);
    expect(rangeHours("nope")).toBe(24);
  });
});
