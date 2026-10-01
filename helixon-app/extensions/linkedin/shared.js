// Settings and calls to the Helixon REST API (/api/v1), shared by the popup
// and the options page. The API key and address live in chrome.storage.local
// on this computer only.

const DEFAULT_BASE = "https://www.helixon.co.uk";

export async function getSettings() {
  const s = await chrome.storage.local.get(["baseUrl", "apiKey"]);
  return { baseUrl: (s.baseUrl || DEFAULT_BASE).replace(/\/+$/, ""), apiKey: s.apiKey || "" };
}

export async function saveSettings({ baseUrl, apiKey }) {
  await chrome.storage.local.set({ baseUrl: (baseUrl || DEFAULT_BASE).trim().replace(/\/+$/, ""), apiKey: (apiKey || "").trim() });
}

// Asks for permission to reach a Helixon address other than the default.
export async function ensureHostPermission(baseUrl) {
  const origin = `${new URL(baseUrl).origin}/*`;
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

export async function api(path, { method = "GET", body } = {}) {
  const { baseUrl, apiKey } = await getSettings();
  if (!apiKey) throw new Error("Add your Helixon API key in the extension's options first.");
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Helixon answered ${res.status}`);
  return data;
}
