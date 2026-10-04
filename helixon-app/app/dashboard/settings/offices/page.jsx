"use client";

// /dashboard/settings/offices - the agency's offices or brands, and who's
// in which (app/api/settings/offices, lib/offices.js). Jobs are put in an
// office from the job page; the jobs list and Analytics filter by office.

import { useEffect, useState } from "react";
import { getRecruiters } from "@/lib/dashboard-api";
import { Button, Card, ErrorText, LoadingCard, Page, PageHeader, Select, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

export default function OfficesPage() {
  const [state, setState] = useState(null);
  const [team, setTeam] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/offices", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then(setState)
      .catch(() => setError("Couldn't load offices."));
    getRecruiters()
      .then((list) => setTeam(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  function change(next) {
    setState((s) => ({ ...s, ...next }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/offices", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offices: state.offices, memberOffices: state.memberOffices }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save.");
      setState(d);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const canManage = state?.canManage;

  return (
    <Page width={800}>
      <PageHeader
        back={{ href: "/dashboard/settings", label: "Settings" }}
        eyebrow="Workspace"
        title="Offices & brands"
        subtitle="Split the workspace by office, team or brand. Put each job in one, then filter jobs and analytics by it."
      />
      {!state && !error && <LoadingCard rows={3} />}
      <ErrorText>{error}</ErrorText>
      {state && (
        <>
          <Card title="Offices">
            {!canManage && <p className="text-[14px] mb-3" style={{ color: INK_MUTED }}>Only the workspace owner or an admin can change these.</p>}
            {state.offices.length === 0 && <p className="text-[14px] mb-3" style={{ color: INK_MUTED }}>No offices yet - the whole workspace is one.</p>}
            <ul className="space-y-2 mb-3">
              {state.offices.map((o, i) => (
                <li key={o.id || `new-${i}`} className="flex items-center gap-2">
                  <TextInput
                    value={o.name}
                    disabled={!canManage}
                    aria-label="Office name"
                    onChange={(e) => change({ offices: state.offices.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const memberOffices = Object.fromEntries(Object.entries(state.memberOffices).filter(([, id]) => id !== o.id));
                        change({ offices: state.offices.filter((_, j) => j !== i), memberOffices });
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {canManage && (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  change({ offices: [...state.offices, { name: draft.trim() }] });
                  setDraft("");
                }}
              >
                <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. London, Manchester, Tech brand" aria-label="New office" />
                <Button type="submit" size="sm" disabled={!draft.trim()}>
                  Add
                </Button>
              </form>
            )}
          </Card>

          {state.offices.some((o) => o.id) && team.length > 0 && (
            <Card title="Who's where">
              <ul className="divide-y -my-3" style={{ borderColor: "var(--border)" }}>
                {team.map((m) => (
                  <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[14px]" style={{ color: INK }}>
                      {m.name}
                    </span>
                    <div className="w-56">
                      <Select
                        value={state.memberOffices[m.id] || ""}
                        disabled={!canManage}
                        aria-label={`${m.name}'s office`}
                        onChange={(e) => {
                          const memberOffices = { ...state.memberOffices };
                          if (e.target.value) memberOffices[m.id] = e.target.value;
                          else delete memberOffices[m.id];
                          change({ memberOffices });
                        }}
                        options={[{ value: "", label: "No office" }, ...state.offices.filter((o) => o.id).map((o) => ({ value: o.id, label: o.name }))]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] mt-4" style={{ color: INK_FAINT }}>
                Save new offices first to put people in them.
              </p>
            </Card>
          )}

          {canManage && (
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              {saved && <span className="text-[13px]" style={{ color: "var(--forest)" }}>Saved</span>}
            </div>
          )}
        </>
      )}
    </Page>
  );
}
