import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const requireCustomerContext = vi.fn();
vi.mock("@/lib/customer-auth", () => ({ requireCustomerContext: (...a) => requireCustomerContext(...a) }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

const { customerRoute, ApiError } = await import("./route");
const { reportError } = await import("@/lib/report-error");

const member = { ok: true, agencyId: "agency-1", userId: "user_1" };
const req = (body, method = "POST") =>
  new Request("http://x.test/api/thing", { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });

describe("customerRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomerContext.mockResolvedValue(member);
  });

  it("refuses signed-out requests before the handler runs", async () => {
    requireCustomerContext.mockResolvedValue({ ok: false, status: 401, error: "Please sign in to continue." });
    const handler = vi.fn();
    const res = await customerRoute(handler)(req(), {});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Please sign in to continue." });
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes request, context and the member to the handler", async () => {
    const handler = vi.fn(async (_r, ctx, auth) => Response.json({ agency: auth.agencyId, id: (await ctx.params).id }));
    const res = await customerRoute(handler)(req(), { params: Promise.resolve({ id: "c1" }) });
    expect(await res.json()).toEqual({ agency: "agency-1", id: "c1" });
  });

  it("asks for a subscription when the route needs one", async () => {
    await customerRoute(vi.fn(async () => Response.json({})), { requireSubscription: true })(req(), {});
    expect(requireCustomerContext).toHaveBeenCalledWith({ requireSubscription: true });
  });

  it("validates the body and explains the first problem", async () => {
    const route = customerRoute(async (_r, _c, _a, body) => Response.json(body), {
      body: z.object({ name: z.string().min(1), fee: z.number().optional() }),
    });
    expect(await (await route(req({ name: "Acme", fee: 9000 }), {})).json()).toEqual({ name: "Acme", fee: 9000 });

    const bad = await route(req({ name: "Acme", fee: "lots" }), {});
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/^fee: /);

    const notJson = await route(req("{oops"), {});
    expect(notJson.status).toBe(400);
    expect((await notJson.json()).error).toMatch(/JSON/);
  });

  it("treats a missing body as {} only when the route says it's optional", async () => {
    const echo = async (_r, _c, _a, body) => Response.json(body);
    expect(await (await customerRoute(echo, { body: z.looseObject({}), optionalBody: true })(req(undefined, "DELETE"), {})).json()).toEqual({});
    expect((await customerRoute(echo, { body: z.looseObject({}) })(req(undefined, "DELETE"), {})).status).toBe(400);
  });

  it("turns thrown errors into JSON: ApiError as given, anything else as a reported 500", async () => {
    const notFound = await customerRoute(async () => {
      throw new ApiError(404, "Not found");
    })(req(), {});
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: "Not found" });

    const boom = await customerRoute(async () => {
      throw new Error("db down");
    })(req(), {});
    expect(boom.status).toBe(500);
    expect(reportError).toHaveBeenCalled();
    expect((await boom.json()).error).not.toMatch(/db down/);
  });
});
