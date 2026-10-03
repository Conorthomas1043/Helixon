"use client";

// Public, account-free self-service page (app/api/portal/[token]), reached
// from a private link the agency sends: a candidate keeps their details and
// availability current and uploads documents like their right to work.

import { use, useEffect, useRef, useState } from "react";
import PublicCard from "@/components/public/PublicCard";

const INK = "var(--ink)";
const MUTED = "var(--ink-soft)";
const input = "w-full text-[14px] px-3 py-2.5 rounded-[10px] focus-visible:outline focus-visible:outline-2";
const inputStyle = { border: "1px solid var(--border)", color: INK, background: "white" };

const FIELDS = [
  ["phone", "Phone", "tel", "tel"],
  ["location", "Where you're based", "text", "address-level2"],
  ["currentTitle", "Current job title", "text", "organization-title"],
  ["currentCompany", "Current employer", "text", "organization"],
  ["linkedin", "LinkedIn profile", "url", "url"],
  ["noticePeriod", "Notice period", "text", null, "e.g. 1 month"],
  ["salaryExpectation", "Salary expectation", "text", null, "e.g. £45,000"],
];

export default function PortalPage({ params }) {
  const { token } = use(params);
  const [info, setInfo] = useState(null);
  const [details, setDetails] = useState({});
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState("right_to_work");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "This link isn't valid.");
        setInfo(d);
        setDetails(d.details);
        setState("ready");
      })
      .catch((e) => {
        setError(e.message);
        setState("error");
      });
  }, [token]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/portal/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(details) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save your details.");
      setSaved(d.changed?.length ? "Saved - thank you." : "Nothing had changed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("document", file);
      const res = await fetch(`/api/portal/${token}`, { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't upload that.");
      setInfo((x) => ({ ...x, documents: [{ id: `new-${Date.now()}`, ...d.document, uploadedAt: new Date().toISOString() }, ...x.documents] }));
      fileRef.current.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (state === "loading") return <PublicCard><p className="text-sm" style={{ color: MUTED }}>Loading…</p></PublicCard>;
  if (state === "error") {
    return (
      <PublicCard>
        <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>Link not available</h1>
        <p className="text-sm" style={{ color: MUTED }}>{error}</p>
      </PublicCard>
    );
  }

  return (
    <PublicCard agencyName={info.agencyName} width={640}>
      <h1 className="text-xl font-semibold" style={{ color: INK, fontFamily: "var(--font-display)" }}>
        {info.firstName ? `Hi ${info.firstName}` : "Your details"}
      </h1>
      <p className="text-[13px] mt-1 mb-6" style={{ color: MUTED }}>
        Check what {info.agencyName || "the agency"} has on file for you, tell them when you&apos;re available, and upload documents they&apos;ve asked for.
      </p>

      <form onSubmit={save} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {FIELDS.map(([key, label, type, autoComplete, placeholder]) => (
            <label key={key} className="block">
              <span className="block text-[13px] font-semibold mb-1.5" style={{ color: INK }}>{label}</span>
              <input type={type} autoComplete={autoComplete || "off"} placeholder={placeholder} maxLength={200} value={details[key] || ""} onChange={(e) => setDetails((d) => ({ ...d, [key]: e.target.value }))} className={input} style={inputStyle} />
            </label>
          ))}
          <label className="block">
            <span className="block text-[13px] font-semibold mb-1.5" style={{ color: INK }}>Available from</span>
            <input type="date" value={details.availableFrom || ""} onChange={(e) => setDetails((d) => ({ ...d, availableFrom: e.target.value }))} className={input} style={inputStyle} />
          </label>
        </div>
        {saved && <p role="status" className="text-[13px]" style={{ color: "var(--forest)" }}>{saved}</p>}
        <button type="submit" disabled={saving} className="w-full text-[14px] font-semibold px-4 py-3 rounded-full disabled:opacity-50" style={{ background: "var(--forest)", color: "white" }}>
          {saving ? "Saving…" : "Save my details"}
        </button>
      </form>

      <section className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }} aria-labelledby="docs">
        <h2 id="docs" className="text-[15px] font-semibold mb-1" style={{ color: INK }}>Documents</h2>
        <p className="text-[13px] mb-3" style={{ color: MUTED }}>PDF, JPG or PNG, up to 10MB. Only {info.agencyName || "the agency"} can see them.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select aria-label="What is it?" value={kind} onChange={(e) => setKind(e.target.value)} className={input} style={{ ...inputStyle, maxWidth: 260 }}>
            {Object.entries(info.documentKinds).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-label="Choose a file" className="text-[13px] flex-1" />
          <button type="button" onClick={upload} disabled={uploading} className="text-[13px] font-semibold px-4 py-2 rounded-full disabled:opacity-50" style={{ border: "1px solid var(--forest)", color: "var(--forest)" }}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        {info.documents.length > 0 && (
          <ul className="mt-4 space-y-2">
            {info.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate" style={{ color: INK }}>
                  {d.kind}: {d.name}
                </span>
                <span className="shrink-0 text-[12px]" style={{ color: MUTED }}>{d.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {error && <p role="alert" className="mt-4 text-[12px]" style={{ color: "var(--score-low)" }}>{error}</p>}
      <p className="mt-6 text-[11px]" style={{ color: MUTED }}>
        This link is private to you and works until {new Date(info.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
      </p>
    </PublicCard>
  );
}
