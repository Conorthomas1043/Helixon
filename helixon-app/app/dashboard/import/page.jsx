"use client";

// /dashboard/import - bring candidates, clients (with contacts) or jobs in
// from a CSV: an export from another ATS (Bullhorn, Vincere, JobAdder ...)
// or a spreadsheet. Columns are matched automatically and can be changed;
// a preview shows exactly what will be created and which rows have
// problems, then rows go up in batches (app/api/import). Anything already
// on file is skipped, so re-running an import is safe.

import { useMemo, useState } from "react";
import { parseCsv } from "@/lib/csv";
import { IMPORT_BATCH, IMPORT_TYPES, MAX_IMPORT_ROWS, guessMapping, mapRow } from "@/lib/import-mapping";
import { Page, PageHeader, Card, Button, ErrorText, Pill, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

async function postBatch(payload) {
  const res = await fetch("/api/import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Import failed");
  return data;
}

export default function ImportPage() {
  const [type, setType] = useState("candidates");
  const [file, setFile] = useState(null);
  const [table, setTable] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState({});
  const [talentPool, setTalentPool] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null);

  const fields = IMPORT_TYPES[type].fields;

  async function load(f, forType = type) {
    setError("");
    setResult(null);
    setFile(f);
    if (!f) return setTable(null);
    if (f.size > 20 * 1024 * 1024) return setError("That file is over 20 MB - split it into smaller files.");
    const rows = parseCsv(await f.text());
    if (rows.length < 2) return setError("That file has no rows under the header.");
    if (rows.length - 1 > MAX_IMPORT_ROWS) return setError(`Up to ${MAX_IMPORT_ROWS.toLocaleString()} rows per file - split it into smaller files.`);
    setTable({ headers: rows[0], rows: rows.slice(1) });
    setMapping(guessMapping(rows[0], forType));
  }

  function changeType(t) {
    setType(t);
    setResult(null);
    if (table) setMapping(guessMapping(table.headers, t));
  }

  const preview = useMemo(() => {
    if (!table) return null;
    const mapped = table.rows.map((cells, i) => ({ row: i + 2, ...mapRow(cells, mapping, type) }));
    return { mapped, bad: mapped.filter((m) => m.errors.length) };
  }, [table, mapping, type]);

  const missingRequired = fields.filter((f) => f.required && mapping[f.key] === undefined);
  const nameMapped = type !== "candidates" || mapping.full_name !== undefined || mapping.first_name !== undefined;

  async function run() {
    setError("");
    setResult(null);
    const total = table.rows.length;
    const totals = { created: 0, contacts: 0, skipped: 0, errors: [] };
    setProgress({ done: 0, total });
    try {
      for (let i = 0; i < total; i += IMPORT_BATCH) {
        const r = await postBatch({ type, mapping, rows: table.rows.slice(i, i + IMPORT_BATCH), firstRow: i + 2, options: { talentPool } });
        totals.created += r.created || 0;
        totals.contacts += r.contacts || 0;
        totals.skipped += r.skipped || 0;
        totals.errors.push(...(r.errors || []));
        setProgress({ done: Math.min(total, i + IMPORT_BATCH), total });
      }
      setResult(totals);
    } catch (err) {
      setError(`${err.message} - ${totals.created} created before it stopped. Re-running the import is safe: anything already on file is skipped.`);
      setResult(totals);
    } finally {
      setProgress(null);
    }
  }

  const sample = (idx) => {
    if (idx === undefined || !table) return "";
    const v = table.rows.find((r) => r[idx])?.[idx] ?? "";
    return v.length > 40 ? `${v.slice(0, 40)}…` : v;
  };

  return (
    <Page width={1000}>
      <PageHeader
        back={{ href: "/dashboard/settings", label: "Settings" }}
        eyebrow="Bring your data"
        title="Import from CSV"
        subtitle="Move over from another ATS or a spreadsheet. Export to CSV, upload it here, check the columns, and import. Anyone already on file is skipped."
      />

      <Card title="1. What are you importing?">
        <div className="flex flex-wrap gap-2">
          {Object.entries(IMPORT_TYPES).map(([k, t]) => (
            <Button key={k} variant={type === k ? "primary" : "secondary"} aria-pressed={type === k} onClick={() => changeType(k)} disabled={Boolean(progress)}>
              {t.label}
            </Button>
          ))}
        </div>
        <p className="text-[12px] mt-3" style={{ color: INK_MUTED }}>
          {type === "candidates" && "People with their contact details, current role and skills. Notes become notes on their profile. They can be screened against a job later from the talent pool (once their CV is uploaded)."}
          {type === "clients" && "Companies, each with an optional contact on the same row. Several rows for the same company add several contacts."}
          {type === "jobs" && "Roles with their client - clients are matched to, or added to, your clients. Jobs need a description before CVs can be screened against them."}
        </p>
      </Card>

      <Card title="2. Upload the CSV">
        <input type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" disabled={Boolean(progress)} onChange={(e) => load(e.target.files?.[0] || null)} className="text-[13px]" style={{ color: INK }} />
        {file && table && (
          <p className="text-[12px] mt-2" style={{ color: INK_MUTED }}>
            {file.name}: {table.rows.length.toLocaleString()} rows, {table.headers.length} columns.
          </p>
        )}
        <ErrorText>{!table ? error : ""}</ErrorText>
      </Card>

      {table && (
        <>
          <Card title="3. Match the columns" eyebrow="Matched automatically - change anything that's wrong">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {fields.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-[13px]">
                  <span className="w-40 shrink-0" style={{ color: INK }}>
                    {f.label}
                    {f.required && <span style={{ color: "var(--score-low)" }}> *</span>}
                  </span>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => {
                      const next = { ...m };
                      if (e.target.value === "") delete next[f.key];
                      else next[f.key] = Number(e.target.value);
                      return next;
                    })}
                    className="flex-1 min-w-0 text-[12px] px-2 py-1.5 rounded-[8px] bg-white"
                    style={{ border: "1px solid var(--border)", color: INK }}
                  >
                    <option value="">Not imported</option>
                    {table.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                  <span className="hidden sm:block w-28 truncate text-[11px]" style={{ color: INK_FAINT }} title={sample(mapping[f.key])}>
                    {sample(mapping[f.key])}
                  </span>
                </label>
              ))}
            </div>
            {type === "candidates" && (
              <label className="flex items-center gap-2 text-[13px] mt-4" style={{ color: INK }}>
                <input type="checkbox" checked={talentPool} onChange={(e) => setTalentPool(e.target.checked)} className="accent-[var(--forest)]" />
                Save everyone to the talent pool, so they come up when jobs open
              </label>
            )}
          </Card>

          <Card
            title="4. Check and import"
            eyebrow={`${preview.mapped.length - preview.bad.length} ready · ${preview.bad.length} with problems`}
            action={preview.bad.length > 0 && <Pill color="#92620f" background="#fdf6e9">Rows with problems are skipped</Pill>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left" style={{ color: INK_FAINT }}>
                    <th className="py-1.5 pr-3 font-semibold">Row</th>
                    {Object.keys(preview.mapped[0]?.record ?? {})
                      .slice(0, 6)
                      .map((k) => (
                        <th key={k} className="py-1.5 pr-3 font-semibold">
                          {fields.find((f) => f.key === k)?.label ?? k.replace(/_/g, " ")}
                        </th>
                      ))}
                    <th className="py-1.5 font-semibold">Problems</th>
                  </tr>
                </thead>
                <tbody>
                  {[...preview.bad.slice(0, 5), ...preview.mapped.filter((m) => !m.errors.length).slice(0, 8)].map((m) => (
                    <tr key={m.row} style={{ borderTop: "1px solid var(--border)", color: INK }}>
                      <td className="py-1.5 pr-3 tabular-nums" style={{ color: INK_FAINT }}>{m.row}</td>
                      {Object.values(m.record)
                        .slice(0, 6)
                        .map((v, i) => (
                          <td key={i} className="py-1.5 pr-3 max-w-[160px] truncate">
                            {Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v)}
                          </td>
                        ))}
                      <td className="py-1.5" style={{ color: "var(--score-low)" }}>{m.errors.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {missingRequired.length > 0 && <ErrorText>Match a column to: {missingRequired.map((f) => f.label).join(", ")}.</ErrorText>}
            {!nameMapped && <ErrorText>Match a column to Full name, or to First name / Last name.</ErrorText>}
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button variant="primary" disabled={Boolean(progress) || missingRequired.length > 0 || !nameMapped || preview.mapped.length === preview.bad.length} onClick={run}>
                {progress ? `Importing… ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}` : `Import ${(preview.mapped.length - preview.bad.length).toLocaleString()} rows`}
              </Button>
              {progress && (
                <div className="flex-1 min-w-[160px] h-2 rounded-full overflow-hidden" style={{ background: "var(--mist)" }}>
                  <div className="h-full" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%`, background: "var(--forest)" }} />
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {result && (
        <Card title="Done">
          <p className="text-[13px]" style={{ color: INK }}>
            Created {result.created.toLocaleString()} {type === "clients" ? "clients" : type}
            {type === "clients" ? ` and ${result.contacts.toLocaleString()} contacts` : ""} · skipped {result.skipped.toLocaleString()} already on file
            {result.errors.length ? ` · ${result.errors.length} rows not imported` : ""}.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-3 max-h-60 overflow-y-auto text-[12px] space-y-1" style={{ color: INK_MUTED }}>
              {result.errors.slice(0, 200).map((e, i) => (
                <li key={i}>
                  {e.row ? `Row ${e.row}: ` : ""}
                  {e.error}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Button href={type === "candidates" ? "/dashboard/candidates" : type === "clients" ? "/dashboard/clients" : "/dashboard/jobs"}>
              Go to {IMPORT_TYPES[type].label.toLowerCase()}
            </Button>
          </div>
        </Card>
      )}
    </Page>
  );
}
