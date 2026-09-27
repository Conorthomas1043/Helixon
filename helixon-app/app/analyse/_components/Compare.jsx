"use client";

// Two candidates for the same role, side by side. The higher value in each
// row is emphasised so the difference reads at a glance.

import { Card, Button, Icon } from "./ui";
import { scoreTone } from "../_lib/analyse";

function nameOf(result, fallback) {
  if (result.blind_mode) return fallback;
  return result.name && result.name !== "Candidate" ? result.name : fallback;
}

function metOf(result) {
  const reqs = result.requirements_met || [];
  return reqs.length ? `${reqs.filter((r) => r.met).length}/${reqs.length}` : null;
}

export default function Compare({ a, b, onClose }) {
  const rows = [
    { label: "Overall", a: a.match_score, b: b.match_score, score: true },
    { label: "Skills", a: a.skill_score, b: b.skill_score, score: true },
    { label: "Experience", a: a.experience_score, b: b.experience_score, score: true },
    { label: "Culture and fit", a: a.culture_score, b: b.culture_score, score: true },
    { label: "Must-haves met", a: metOf(a), b: metOf(b) },
    { label: "Skills matched", a: a.matched_skills?.length ?? null, b: b.matched_skills?.length ?? null, higherBetter: true },
    { label: "Required skills missing", a: a.missing_required?.length ?? null, b: b.missing_required?.length ?? null, lowerBetter: true },
    { label: "Red flags", a: a.red_flags?.length ?? 0, b: b.red_flags?.length ?? 0, lowerBetter: true },
  ].filter((r) => r.a != null || r.b != null);

  function better(row, side) {
    if (typeof row.a !== "number" || typeof row.b !== "number" || row.a === row.b) return false;
    const aWins = row.lowerBetter ? row.a < row.b : row.a > row.b;
    return side === "a" ? aWins : !aWins;
  }

  const cell = (row, side) => {
    const value = row[side];
    const win = better(row, side);
    const color = row.score && value != null ? scoreTone(value).fg : "var(--ink)";
    return (
      <td className="px-4 py-2.5 text-right tabular-nums text-[13.5px]" style={{ color, fontWeight: win ? 600 : 400, opacity: value == null ? 0.4 : 1 }}>
        {value ?? "–"}
      </td>
    );
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-[var(--ink)] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
          <Icon name="compare" size={16} className="text-[var(--ink-soft)]" /> Comparison
        </h3>
        <Button size="sm" variant="ghost" icon="x" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-y border-[var(--border-soft)] bg-[var(--mist)]">
              <th className="px-5 py-2.5 text-[12px] font-medium text-[var(--ink-soft)]" />
              <th className="px-4 py-2.5 text-[12.5px] font-semibold text-[var(--ink)] text-right">{nameOf(a, "Candidate A")}</th>
              <th className="px-4 py-2.5 text-[12.5px] font-semibold text-[var(--ink)] text-right">{nameOf(b, "Candidate B")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-5 py-2.5 text-[13px] font-normal text-[var(--ink-soft)]">
                  {row.label}
                </th>
                {cell(row, "a")}
                {cell(row, "b")}
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-5 py-2.5 text-[13px] font-normal text-[var(--ink-soft)]">
                Recommendation
              </th>
              <td className="px-4 py-2.5 text-right text-[13px] text-[var(--ink)]">{a.recommendation || "–"}</td>
              <td className="px-4 py-2.5 text-right text-[13px] text-[var(--ink)]">{b.recommendation || "–"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
