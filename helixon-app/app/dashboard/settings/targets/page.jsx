"use client";

// /dashboard/settings/targets - monthly targets for the team and each
// recruiter, and the commission plan (app/api/performance/settings).
// Owner and admins only.

import { useCallback, useEffect, useState } from "react";
import { getPerformanceSettings, savePerformanceSettings } from "@/lib/dashboard-api";
import { METRICS, METRIC_KEYS } from "@/lib/performance";
import { Page, PageHeader, Card, Button, ErrorState, ErrorText, Field, LoadingCard, Select, TextInput, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

const cell = "w-full text-[13px] px-2 py-1.5 rounded-[6px] bg-white text-right tabular-nums";
const cellStyle = { border: "1px solid var(--border)", color: INK, minWidth: 70 };

export default function TargetsSettingsPage() {
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [people, setPeople] = useState([]);
  const [targets, setTargets] = useState({ team: {}, people: {} });
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPerformanceSettings()
      .then((d) => {
        if (cancelled) return;
        setPeople(d.people);
        setTargets(d.targets);
        setPlan({ ...d.commission, tiers: d.commission.tiers.length ? d.commission.tiers : [{ from: 0, rate: 10 }] });
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  const setTarget = (who, key, v) =>
    setTargets((t) =>
      who === "team" ? { ...t, team: { ...t.team, [key]: v } } : { ...t, people: { ...t.people, [who]: { ...(t.people[who] || {}), [key]: v } } }
    );
  const setThreshold = (id, v) =>
    setPlan((p) => {
      const next = { ...(p.people || {}) };
      if (v === "") delete next[id];
      else next[id] = { threshold: v };
      return { ...p, people: next };
    });

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const d = await savePerformanceSettings({ targets, commission: plan });
      setTargets(d.targets);
      setPlan({ ...d.commission, tiers: d.commission.tiers.length ? d.commission.tiers : [{ from: 0, rate: 10 }] });
      setNotice("Saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const rows = [{ id: "team", name: "Whole team" }, ...people];

  return (
    <Page width={1200}>
      <PageHeader
        back={{ href: "/dashboard/settings", label: "Settings" }}
        eyebrow="Team"
        title="Targets & commission"
        subtitle="Monthly targets - quarters and years multiply them up. They show as progress bars on the Performance page."
      />
      {status === "loading" && <LoadingCard rows={6} />}
      {status === "error" && <ErrorState title="Unable to load targets" body={loadError} onRetry={retry} />}
      {status === "ready" && (
        <>
          <Card title="Monthly targets">
            <div className="overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-widest" style={{ color: INK_FAINT }}>
                    <th className="px-5 sm:px-6 py-2 font-semibold" />
                    {METRIC_KEYS.map((k) => (
                      <th key={k} className="px-1.5 py-2 font-semibold text-right whitespace-nowrap">
                        {METRICS[k].short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const t = r.id === "team" ? targets.team : targets.people[r.id] || {};
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-5 sm:px-6 py-2 whitespace-nowrap font-semibold" style={{ color: INK }}>
                          {r.name}
                        </td>
                        {METRIC_KEYS.map((k) => (
                          <td key={k} className="px-1.5 py-2">
                            <input
                              type="number"
                              min="0"
                              step={METRICS[k].money ? "100" : "1"}
                              aria-label={`${r.name} ${METRICS[k].label} target`}
                              value={t[k] ?? ""}
                              onChange={(e) => setTarget(r.id, k, e.target.value)}
                              className={cell}
                              style={cellStyle}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Commission">
            <label className="flex items-center gap-2 text-[14px] mb-4" style={{ color: INK }}>
              <input type="checkbox" checked={plan.enabled} onChange={(e) => setPlan((p) => ({ ...p, enabled: e.target.checked }))} />
              Work out commission on the Performance page
            </label>
            <fieldset disabled={!plan.enabled} className="space-y-4 disabled:opacity-50">
              <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
                <Field label="Paid on">
                  <Select
                    value={plan.basis}
                    onChange={(e) => setPlan((p) => ({ ...p, basis: e.target.value }))}
                    options={[
                      { value: "fees", label: "Fees placed (perm offers accepted)" },
                      { value: "cash", label: "Cash collected (invoices paid)" },
                    ]}
                  />
                </Field>
                <Field label="Monthly threshold" hint="Nothing is paid on the first this much a month.">
                  <TextInput type="number" min="0" step="100" value={plan.threshold} onChange={(e) => setPlan((p) => ({ ...p, threshold: e.target.value }))} />
                </Field>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
                  Rates above the threshold
                </p>
                <ul className="space-y-2 max-w-xl">
                  {plan.tiers.map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-[14px]" style={{ color: INK_MUTED }}>
                      <span className="whitespace-nowrap">From</span>
                      <TextInput
                        type="number"
                        min="0"
                        step="100"
                        aria-label="Band starts at"
                        value={t.from}
                        disabled={i === 0}
                        onChange={(e) => setPlan((p) => ({ ...p, tiers: p.tiers.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) }))}
                      />
                      <span className="whitespace-nowrap">over threshold, pay</span>
                      <TextInput
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        aria-label="Rate %"
                        value={t.rate}
                        onChange={(e) => setPlan((p) => ({ ...p, tiers: p.tiers.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)) }))}
                        style={{ maxWidth: 90 }}
                      />
                      <span>%</span>
                      {i > 0 && (
                        <button type="button" aria-label="Remove band" onClick={() => setPlan((p) => ({ ...p, tiers: p.tiers.filter((_, j) => j !== i) }))} style={{ color: "var(--score-low)" }}>
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="text-[13px] font-semibold mt-2"
                  style={{ color: "var(--forest)" }}
                  onClick={() => setPlan((p) => ({ ...p, tiers: [...p.tiers, { from: (Number(p.tiers[p.tiers.length - 1]?.from) || 0) + 20000, rate: 15 }] }))}
                >
                  + Add a band
                </button>
              </div>
              {people.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
                    Personal thresholds (optional)
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-2 max-w-xl">
                    {people.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-[14px]">
                        <span className="flex-1 truncate" style={{ color: INK }}>
                          {p.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          aria-label={`${p.name} threshold`}
                          placeholder={String(plan.threshold || 0)}
                          value={plan.people?.[p.id]?.threshold ?? ""}
                          onChange={(e) => setThreshold(p.id, e.target.value)}
                          className={cell}
                          style={{ ...cellStyle, maxWidth: 120 }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </fieldset>
            <p className="text-[12px] mt-4" style={{ color: INK_MUTED }}>
              Recruiters see their own commission; you see everyone&apos;s. It&apos;s an estimate to track against - payroll stays with you.
            </p>
          </Card>

          <ErrorText>{error}</ErrorText>
          {notice && (
            <p className="text-[13px]" role="status" style={{ color: "var(--forest)" }}>
              {notice}
            </p>
          )}
          <div>
            <Button variant="primary" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      )}
    </Page>
  );
}
