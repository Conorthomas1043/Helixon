import posthog from "@/lib/posthog";

// Shared by the homepage pricing section and /pricing, which had drifted:
// one crashed on a non-JSON error response, the other didn't. Resolves to
// { ok: true, redirectTo } or { ok: false, error } and never throws, so a
// caller only has to show the message or follow the redirect.
export async function startCheckout(plan) {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON error page */ }

    if (!res.ok || !data?.ok || !data?.redirectTo) {
      return { ok: false, error: data?.error || "Checkout couldn't be started. Please try again." };
    }

    if (posthog.__loaded) posthog.capture("checkout_started", { plan });
    return { ok: true, redirectTo: data.redirectTo };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}
