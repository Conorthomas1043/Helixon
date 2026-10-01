import { api, ensureHostPermission, getSettings, saveSettings } from "./shared.js";

const form = document.getElementById("form");
const baseUrl = document.getElementById("baseUrl");
const apiKey = document.getElementById("apiKey");
const status = document.getElementById("status");

getSettings().then((s) => {
  baseUrl.value = s.baseUrl;
  apiKey.value = s.apiKey;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  status.className = "muted";
  status.textContent = "Checking…";
  try {
    if (!(await ensureHostPermission(baseUrl.value))) throw new Error("The extension needs permission to reach that address.");
    await saveSettings({ baseUrl: baseUrl.value, apiKey: apiKey.value });
    const res = await api("");
    status.className = "ok";
    status.textContent = `Connected to ${res.workspace || "Helixon"} as ${res.actingAs}.`;
  } catch (err) {
    status.className = "error";
    status.textContent = err.message;
  }
});
