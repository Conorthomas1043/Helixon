// The popup: reads the LinkedIn profile in the current tab (only when it's
// opened), lets you check the details, pick a job and add a note, then
// saves the candidate through POST /api/v1/candidates.

import { api, getSettings } from "./shared.js";

const app = document.getElementById("app");

// Runs inside the LinkedIn tab. LinkedIn's markup changes often, so each
// field has fallbacks; whatever's found is shown for checking before save.
function readProfile() {
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const main = document.querySelector("main") || document;
  const name = text(main.querySelector("h1")) || document.title.split("|")[0].trim();
  const headline = text(main.querySelector(".text-body-medium.break-words")) || "";
  const place = text(main.querySelector(".text-body-small.inline.t-black--light.break-words")) || "";
  const url = document.querySelector('link[rel="canonical"]')?.href || window.location.href.split("?")[0];
  return { name, headline, location: place, url };
}

function splitHeadline(headline) {
  const m = /^(.*?)\s+(?:at|@)\s+(.+)$/i.exec(headline || "");
  return m ? { title: m[1].trim(), company: m[2].split("|")[0].trim() } : { title: (headline || "").split("|")[0].trim(), company: "" };
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function field(label, input) {
  return el("label", {}, el("span", {}, label), input);
}

function message(text, cls = "muted") {
  app.replaceChildren(el("p", { class: cls }, text));
}

async function main() {
  const { apiKey, baseUrl } = await getSettings();
  if (!apiKey) {
    app.replaceChildren(el("p", {}, "Add your Helixon API key first."), el("button", { onclick: () => chrome.runtime.openOptionsPage() }, "Open settings"));
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https:\/\/([a-z]+\.)?linkedin\.com\/in\//.test(tab.url)) {
    message("Open someone's LinkedIn profile (linkedin.com/in/…) and click the Helixon button again.");
    return;
  }
  let profile;
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readProfile });
    profile = result.result;
  } catch {
    message("Couldn't read this page - try reloading it.", "error");
    return;
  }
  const { title, company } = splitHeadline(profile.headline);

  const inputs = {
    name: el("input", { value: profile.name || "", maxlength: "120", required: "" }),
    currentTitle: el("input", { value: title, maxlength: "160" }),
    currentCompany: el("input", { value: company, maxlength: "160" }),
    location: el("input", { value: profile.location || "", maxlength: "120" }),
    email: el("input", { type: "email", placeholder: "If you have it", maxlength: "254" }),
    job: el("select", {}, el("option", { value: "" }, "No job - just save them")),
    note: el("textarea", { rows: "3", maxlength: "5000", placeholder: "Why they're interesting…" }),
  };
  api("/jobs?status=open&pageSize=100")
    .then((res) => {
      for (const j of res.data) inputs.job.append(el("option", { value: j.id }, j.client ? `${j.title} - ${j.client}` : j.title));
    })
    .catch(() => {});

  const status = el("p", { class: "muted" });
  const save = el("button", { type: "submit" }, "Save to Helixon");
  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        save.disabled = true;
        status.className = "muted";
        status.textContent = "Saving…";
        try {
          const res = await api("/candidates", {
            method: "POST",
            body: {
              name: inputs.name.value,
              currentTitle: inputs.currentTitle.value,
              currentCompany: inputs.currentCompany.value,
              location: inputs.location.value,
              email: inputs.email.value || undefined,
              linkedin: profile.url,
              jobId: inputs.job.value || undefined,
              stage: inputs.job.value ? "Screened" : undefined,
              source: "linkedin",
              note: inputs.note.value || undefined,
            },
          });
          const link = el("a", { href: `${baseUrl}${res.data.url}`, target: "_blank" }, "Open in Helixon");
          app.replaceChildren(el("p", { class: "ok" }, res.duplicate ? `${res.data.name} is already in Helixon (matched on ${res.matchedOn}).` : `Saved ${res.data.name}.`), link);
        } catch (err) {
          status.className = "error";
          status.textContent = err.message;
          save.disabled = false;
        }
      },
    },
    field("Name", inputs.name),
    field("Current title", inputs.currentTitle),
    field("Company", inputs.currentCompany),
    field("Location", inputs.location),
    field("Email", inputs.email),
    field("Add to job", inputs.job),
    field("Note", inputs.note),
    save,
    status
  );
  app.replaceChildren(form);
}

main().catch((err) => message(err.message, "error"));
