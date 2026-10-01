"use client";

// "Advertise" on a job's page: write the public advert, publish it to the
// agency's jobs page (/jobs/<slug>/<job>), and copy a tracked link for each
// channel - applications are tagged with where they came from and visits
// are counted in the Sourcing panel (lib/careers.js).

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCareersSettings, updateJob } from "@/lib/dashboard-api";
import { SHARE_CHANNELS } from "@/lib/careers";
import { Card, Button, ErrorText, Field, Pill, TextArea, TextInput, INK, INK_MUTED } from "@/components/dashboard/ui";

export default function AdvertisePanel({ job, onSaved }) {
  const [careers, setCareers] = useState(null);
  const [f, setF] = useState({
    publicTitle: job.publicTitle || job.title || "",
    publicDescription: job.publicDescription || job.job_text || "",
    hideClient: job.hideClient,
    showSalary: job.showSalary,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    getCareersSettings().then(setCareers).catch(() => setCareers(false));
  }, []);

  async function save(extra = {}) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await updateJob(job.id, { ...f, ...extra });
      onSaved?.(updated);
      setNotice(extra.published === true ? "Published - it's live on your jobs page." : extra.published === false ? "Taken down." : "Saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const live = job.published && job.status === "open" && careers?.enabled;
  const jobUrl = careers?.pageUrl ? `${careers.pageUrl}/${job.id}` : null;

  function copy(src) {
    const url = `${jobUrl}${src ? `?src=${src}` : ""}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(src || "direct");
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <Card
      eyebrow="Advertise"
      title="Job advert"
      action={
        job.published ? (
          <Pill color={live ? "var(--forest)" : "#92620f"} background={live ? "var(--mint)" : "#fdf6e9"}>
            {live ? "Live" : job.status !== "open" ? "Published - job closed" : "Published - jobs page off"}
          </Pill>
        ) : (
          <Pill>Not published</Pill>
        )
      }
    >
      {careers && !careers.enabled && (
        <p className="text-[12px] mb-4 rounded-[10px] px-3 py-2" style={{ background: "#fff8e6", color: "#7a4f0a" }}>
          Your public jobs page is switched off.{" "}
          <Link href="/dashboard/settings/careers" className="underline font-semibold">
            Set it up
          </Link>{" "}
          to take applications.
        </p>
      )}
      <div className="space-y-3">
        <Field label="Advert title">
          <TextInput maxLength={200} value={f.publicTitle} onChange={(e) => setF((v) => ({ ...v, publicTitle: e.target.value }))} />
        </Field>
        <Field label="Advert" hint="What applicants see. Starts from the job description - remove anything internal, like the client's name if it's confidential.">
          <TextArea rows={10} maxLength={20000} value={f.publicDescription} onChange={(e) => setF((v) => ({ ...v, publicDescription: e.target.value }))} />
        </Field>
        <div className="flex flex-wrap gap-4 text-[13px]" style={{ color: INK }}>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!f.hideClient} onChange={(e) => setF((v) => ({ ...v, hideClient: !e.target.checked }))} className="accent-[var(--forest)]" />
            Show the client&apos;s name{job.company ? ` (${job.company})` : ""}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.showSalary} onChange={(e) => setF((v) => ({ ...v, showSalary: e.target.checked }))} className="accent-[var(--forest)]" />
            Show the salary{job.salaryRange ? ` (${job.salaryRange})` : ""}
          </label>
        </div>
        <ErrorText>{error}</ErrorText>
        {notice && <p className="text-[12px]" role="status" style={{ color: INK_MUTED }}>{notice}</p>}
        <div className="flex flex-wrap gap-2">
          {job.published ? (
            <>
              <Button variant="primary" disabled={saving} onClick={() => save()}>Save changes</Button>
              <Button disabled={saving} onClick={() => save({ published: false })}>Take down</Button>
            </>
          ) : (
            <>
              <Button variant="primary" disabled={saving || !f.publicDescription.trim()} onClick={() => save({ published: true })}>Publish</Button>
              <Button disabled={saving} onClick={() => save()}>Save draft</Button>
            </>
          )}
          {live && jobUrl && (
            <Button href={jobUrl} target="_blank" rel="noopener noreferrer">View advert ↗</Button>
          )}
        </div>
      </div>

      {live && jobUrl && (
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[12px] font-semibold mb-2" style={{ color: INK }}>Share links - applications are tagged with where they came from</p>
          <ul className="space-y-1.5">
            {SHARE_CHANNELS.map((c) => (
              <li key={c.src || "direct"} className="flex items-center gap-2 text-[12px]">
                <span className="w-36 shrink-0" style={{ color: INK_MUTED }}>{c.label}</span>
                <code className="flex-1 min-w-0 truncate rounded px-2 py-1" style={{ background: "var(--mist)", color: INK }}>
                  {jobUrl}
                  {c.src ? `?src=${c.src}` : ""}
                </code>
                <Button size="sm" onClick={() => copy(c.src)}>{copied === (c.src || "direct") ? "Copied" : "Copy"}</Button>
              </li>
            ))}
          </ul>
          {careers.feedUrl && (
            <p className="text-[11px] mt-3" style={{ color: INK_MUTED }}>
              Job boards that take an XML feed (Indeed and most aggregators) can read all your live jobs from <code>{careers.feedUrl}</code>. Each job page is also marked up for Google for Jobs.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
