import { describe, expect, it } from "vitest";
import {
  expandIPv6,
  hostingProvider,
  ipScope,
  neighbourhood,
  parseCymruAsName,
  parseCymruOrigin,
  parseRdap,
  reverseName,
  verifyCrawler,
} from "./ip-intel";

describe("address helpers", () => {
  it("expands and reverses addresses for DNS zones", () => {
    expect(expandIPv6("2001:db8::1")).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(expandIPv6("::ffff:1.2.3.4")).toBe("0000:0000:0000:0000:0000:ffff:0102:0304");
    expect(reverseName("1.2.3.4")).toBe("4.3.2.1");
    expect(reverseName("2001:db8::1").startsWith("1.0.0.0.0.0.0.0")).toBe(true);
    expect(reverseName("2001:db8::1").endsWith("8.b.d.0.1.0.0.2")).toBe(true);
  });

  it("finds the neighbourhood and scope", () => {
    expect(neighbourhood("45.9.1.200")).toBe("45.9.1.0/24");
    expect(neighbourhood("2001:db8:1:2:3::9")).toBe("2001:0db8:0001:0002::/64");
    expect(ipScope("10.1.2.3")).toBe("private");
    expect(ipScope("100.64.0.1")).toBe("private");
    expect(ipScope("fd00::1")).toBe("private");
    expect(ipScope("81.2.69.160")).toBe("public");
    expect(ipScope("unknown")).toBe("invalid");
  });
});

describe("Team Cymru answers", () => {
  it("parses origin and AS name records", () => {
    expect(parseCymruOrigin("13335 | 1.1.1.0/24 | AU | apnic | 2011-08-11")).toEqual({ asn: 13335, prefix: "1.1.1.0/24", country: "AU", registry: "apnic", allocated: "2011-08-11" });
    expect(parseCymruOrigin("396982 15169 | 34.107.0.0/17 | US | arin | ").asn).toBe(396982);
    expect(parseCymruOrigin("")).toBe(null);
    expect(parseCymruAsName("13335 | US | arin | 2010-07-14 | CLOUDFLARENET, US")).toBe("CLOUDFLARENET, US");
  });
});

describe("parseRdap", () => {
  it("pulls the network, owner and abuse contact from nested entities", () => {
    const out = parseRdap(
      {
        handle: "NET-34-64-0-0-1",
        name: "GOOGLE-CLOUD",
        startAddress: "34.64.0.0",
        endAddress: "34.127.255.255",
        cidr0_cidrs: [{ v4prefix: "34.64.0.0", length: 10 }],
        entities: [
          {
            roles: ["registrant"],
            vcardArray: ["vcard", [["fn", {}, "text", "Google LLC"]]],
            entities: [{ roles: ["abuse"], vcardArray: ["vcard", [["email", {}, "text", "network-abuse@google.com"]]] }],
          },
        ],
        events: [{ eventAction: "registration", eventDate: "2016-05-09T00:00:00Z" }],
      },
      "https://rdap.arin.net/registry/ip/34.107.93.3",
    );
    expect(out).toMatchObject({
      name: "GOOGLE-CLOUD",
      range: "34.64.0.0 - 34.127.255.255",
      cidrs: ["34.64.0.0/10"],
      owner: "Google LLC",
      abuseEmail: "network-abuse@google.com",
      registered: "2016-05-09T00:00:00Z",
    });
  });
});

describe("hostingProvider", () => {
  it("recognises cloud networks but not home broadband", () => {
    expect(hostingProvider("GOOGLE-CLOUD-PLATFORM, US")).toBe("Google Cloud");
    expect(hostingProvider("AMAZON-02, US")).toBe("Amazon Web Services");
    expect(hostingProvider("GOOGLE-FIBER, US", "Google Fiber Inc.")).toBe(null);
    expect(hostingProvider("BT-UK-AS BTnet UK Regional network, GB")).toBe(null);
    expect(hostingProvider("LAWSONS-NET")).toBe(null);
  });
});

describe("verifyCrawler", () => {
  const googlebot = ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"];
  it("verifies a crawler by its forward-confirmed hostname", () => {
    expect(verifyCrawler(googlebot, ["crawl-66-249-66-1.googlebot.com"])).toEqual({ claimed: "Googlebot", verified: true });
  });
  it("flags a spoofed crawler", () => {
    expect(verifyCrawler(googlebot, ["static.123.45.67.89.clients.your-server.de"])).toEqual({ claimed: "Googlebot", verified: false });
    expect(verifyCrawler(googlebot, ["evilgooglebot.com"])).toEqual({ claimed: "Googlebot", verified: false });
    // A rented Google Cloud VM is not Googlebot.
    expect(verifyCrawler(googlebot, ["3.93.107.34.bc.googleusercontent.com"])).toEqual({ claimed: "Googlebot", verified: false });
  });
  it("says nothing for ordinary browsers", () => {
    expect(verifyCrawler(["Mozilla/5.0 (Macintosh) Safari/605"], [])).toBe(null);
  });
});
