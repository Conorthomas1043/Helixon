"use client";

// /dashboard/clients/[id] - one client: details and fee terms, the people
// there (contacts), their jobs, the placements made with them and the
// relationship timeline (app/api/clients/[id]).

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getClient,
  updateClient,
  deleteClient,
  addClientContact,
  updateClientContact,
  removeClientContact,
  logClientActivity,
} from "@/lib/dashboard-api";
import {
  Page,
  PageHeader,
  Card,
  Button,
  Field,
  TextInput,
  TextArea,
  Select,
  Dialog,
  ErrorState,
  ErrorText,
  LoadingCard,
  Pill,
  formatMoney,
  INK,
  INK_MUTED,
  INK_FAINT,
} from "@/components/dashboard/ui";
import { formatDateOnly, formatRelativeTime } from "@/lib/candidate-format";
import { CustomFieldsCard } from "@/components/dashboard/custom-fields";
import { InvoiceStatusPill } from "@/components/dashboard/placements";
import { ClientDealsCard, ClientFollowUpCard } from "@/components/dashboard/opportunities";
import SignaturesCard from "@/components/dashboard/SignaturesCard";
import { termsOfBusinessText } from "@/lib/signatures-shared";

const ACTIVITY_LABELS = {
  client_created: "Client added",
  client_updated: "Details updated",
  contact_added: "Contact added",
  contact_removed: "Contact removed",
  call_logged: "Call",
  email_logged: "Email",
  meeting_logged: "Meeting",
  note_added: "Note",
  job_created: "Job added",
  shortlist_shared: "Shortlist shared",
  shortlist_feedback: "Shortlist feedback",
  interview_scheduled: "Interview scheduled",
  placement_made: "Placement",
  invoice_sent: "Invoice",
  opportunity_created: "Deal added",
  opportunity_stage: "Deal moved",
  next_action_completed: "Follow-up done",
  signature_requested: "Sent for signature",
  signature_signed: "Signed",
  signature_declined: "Signature declined",
};

function EditClientDialog({ client, onClose, onSaved }) {
  const [f, setF] = useState({
    name: client.name || "",
    industry: client.industry || "",
    website: client.website || "",
    address: client.address || "",
    status: client.status,
    feePercent: client.feePercent ?? "",
    paymentTermsDays: client.paymentTermsDays ?? "",
    rebateDays: client.rebateDays ?? "",
    termsNotes: client.termsNotes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateClient(client.id, f);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Dialog title="Edit client" onClose={onClose} busy={saving} width={620}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Company name" className="sm:col-span-2">
            <TextInput required maxLength={200} value={f.name} onChange={set("name")} />
          </Field>
          <Field label="Industry">
            <TextInput maxLength={120} value={f.industry} onChange={set("industry")} />
          </Field>
          <Field label="Website">
            <TextInput maxLength={300} value={f.website} onChange={set("website")} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <TextInput maxLength={500} value={f.address} onChange={set("address")} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={set("status")} options={[{ value: "active", label: "Active" }, { value: "prospect", label: "Prospect" }, { value: "inactive", label: "Inactive" }]} />
          </Field>
          <Field label="Fee (% of salary)">
            <TextInput type="number" min={0} max={100} step="0.5" value={f.feePercent} onChange={set("feePercent")} />
          </Field>
          <Field label="Payment terms (days)">
            <TextInput type="number" min={0} max={365} value={f.paymentTermsDays} onChange={set("paymentTermsDays")} />
          </Field>
          <Field label="Rebate period (days)" hint="How long after a start date a fee is refundable if they leave.">
            <TextInput type="number" min={0} max={365} value={f.rebateDays} onChange={set("rebateDays")} />
          </Field>
          <Field label="Terms notes" className="sm:col-span-2">
            <TextArea maxLength={2000} value={f.termsNotes} onChange={set("termsNotes")} placeholder="e.g. Sliding scale: 15% under £40k, 20% above; exclusive on senior roles" />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ContactDialog({ clientId, contact, onClose, onSaved }) {
  const [f, setF] = useState({
    name: contact?.name || "",
    jobTitle: contact?.jobTitle || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    notes: contact?.notes || "",
    isPrimary: contact?.isPrimary ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (contact) await updateClientContact(clientId, contact.id, f);
      else await addClientContact(clientId, f);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Dialog title={contact ? "Edit contact" : "New contact"} onClose={onClose} busy={saving}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name">
            <TextInput required maxLength={200} value={f.name} onChange={set("name")} />
          </Field>
          <Field label="Job title">
            <TextInput maxLength={200} value={f.jobTitle} onChange={set("jobTitle")} placeholder="e.g. Head of Engineering" />
          </Field>
          <Field label="Email">
            <TextInput type="email" maxLength={254} value={f.email} onChange={set("email")} />
          </Field>
          <Field label="Phone">
            <TextInput type="tel" maxLength={40} value={f.phone} onChange={set("phone")} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <TextArea maxLength={2000} value={f.notes} onChange={set("notes")} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: INK }}>
          <input type="checkbox" checked={f.isPrimary} onChange={(e) => setF((v) => ({ ...v, isPrimary: e.target.checked }))} className="accent-[var(--forest)]" />
          Main contact for this client
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : contact ? "Save" : "Add contact"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function LogActivity({ clientId, onLogged }) {
  const [type, setType] = useState("note_added");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await logClientActivity(clientId, type, note);
      setNote("");
      onLogged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 mb-4">
      <div className="flex gap-2">
        <Select
          aria-label="What happened"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="!w-auto"
          options={[
            { value: "note_added", label: "Note" },
            { value: "call_logged", label: "Call" },
            { value: "email_logged", label: "Email" },
            { value: "meeting_logged", label: "Meeting" },
          ]}
        />
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="What was discussed?" aria-label="Details" />
        <Button type="submit" variant="primary" disabled={saving || (type === "note_added" && !note.trim())}>
          Log
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

export default function ClientDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [contactDialog, setContactDialog] = useState(null); // null | "new" | contact
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getClient(id)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) setStatus(err.message === "Not found" ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const closeEdit = useCallback(() => setEditing(false), []);
  const closeContact = useCallback(() => setContactDialog(null), []);

  async function removeContact(contact) {
    if (!window.confirm(`Remove ${contact.name}?`)) return;
    try {
      await removeClientContact(id, contact.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${data.client.name}? This can't be undone.`)) return;
    try {
      await deleteClient(id);
      router.push("/dashboard/clients");
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === "loading") {
    return (
      <Page width={1100}>
        <LoadingCard rows={6} />
      </Page>
    );
  }
  if (status !== "ready") {
    return (
      <Page width={1100}>
        <ErrorState
          title={status === "not-found" ? "Client not found" : "Unable to load this client"}
          body={status === "not-found" ? "It may have been deleted." : null}
          onRetry={status === "error" ? reload : null}
        />
      </Page>
    );
  }

  const { client, contacts, jobs, placements, activity } = data;
  const invoices = data.invoices ?? [];
  const fees = placements.reduce((s, p) => s + (p.fee || 0), 0);
  const outstanding = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + Number(i.total || 0), 0);
  const openJobs = jobs.filter((j) => j.status === "open");

  return (
    <Page width={1100}>
      <PageHeader
        back={{ href: "/dashboard/clients", label: "All clients" }}
        eyebrow={client.industry || "Client"}
        title={client.name}
        subtitle={
          <>
            {client.website && (
              <a href={/^https?:\/\//.test(client.website) ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="underline">
                {client.website}
              </a>
            )}
            {client.website && " · "}
            {openJobs.length} open job{openJobs.length === 1 ? "" : "s"} · {placements.length} placement{placements.length === 1 ? "" : "s"} · {formatMoney(fees)} billed
            {client.ownerName ? ` · Owner: ${client.ownerName}` : ""}
          </>
        }
        actions={
          <>
            {client.status !== "active" && <Pill>{client.status === "prospect" ? "Prospect" : "Inactive"}</Pill>}
            <Button variant="primary" href={`/dashboard/jobs?new=1&clientId=${client.id}`}>
              New job
            </Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
            {jobs.length === 0 && (
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            )}
          </>
        }
      />
      <ErrorText>{error}</ErrorText>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card title="Jobs" eyebrow={`${jobs.length} total`}>
            {jobs.length === 0 ? (
              <p className="text-[13px]" style={{ color: INK_MUTED }}>
                No jobs for {client.name} yet.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/dashboard/jobs/${j.id}`} className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-[10px] hover:bg-[var(--mist)]">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: INK }}>
                          {j.title}
                        </p>
                        <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
                          {[j.location, j.salaryRange, `added ${formatDateOnly(j.createdAt)}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="text-[12px] tabular-nums whitespace-nowrap" style={{ color: INK_MUTED }}>
                        {j.candidates} cand · {j.inProcess} in process · {j.placed} placed
                      </span>
                      <Pill color={j.status === "open" ? "var(--forest)" : INK_FAINT} background={j.status === "open" ? "var(--mint)" : "var(--mist)"}>
                        {j.status === "open" ? "Open" : "Closed"}
                      </Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Placements" eyebrow={formatMoney(fees)}>
            {placements.length === 0 ? (
              <p className="text-[13px]" style={{ color: INK_MUTED }}>
                No placements yet.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {placements.map((p) => (
                  <li key={p.candidateId} className="py-2.5 flex items-center gap-3 text-[13px]">
                    <Link href={`/dashboard/candidates/${p.candidateId}`} className="font-semibold hover:underline flex-1 min-w-0 truncate" style={{ color: INK }}>
                      {p.candidateName}
                    </Link>
                    <span className="truncate" style={{ color: INK_MUTED }}>
                      {p.jobTitle}
                    </span>
                    <span className="tabular-nums font-semibold" style={{ color: INK }}>
                      {p.fee != null ? formatMoney(p.fee) : "-"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {invoices.length > 0 && (
            <Card title="Invoices" eyebrow={outstanding ? `${formatMoney(outstanding)} outstanding` : "All paid"}>
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {invoices.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center gap-3 text-[13px]">
                    <Link href={`/dashboard/invoices/${i.id}`} className="font-semibold hover:underline" style={{ color: "var(--forest)" }}>
                      {i.number}
                    </Link>
                    <span className="flex-1" style={{ color: INK_MUTED }}>
                      {i.issued_on}
                    </span>
                    <InvoiceStatusPill invoice={i} />
                    <span className="tabular-nums font-semibold" style={{ color: INK }}>
                      {formatMoney(i.total, i.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Timeline">
            <LogActivity clientId={id} onLogged={reload} />
            {activity.length === 0 ? (
              <p className="text-[13px]" style={{ color: INK_MUTED }}>
                Nothing logged yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="text-[13px]">
                    <span className="font-semibold" style={{ color: INK }}>
                      {ACTIVITY_LABELS[a.type] ?? a.type}
                    </span>
                    {a.meta?.note && <span style={{ color: INK }}> - {a.meta.note}</span>}
                    <span className="block text-[11px]" style={{ color: INK_FAINT }}>
                      {a.actor ? `${a.actor} · ` : ""}
                      {formatRelativeTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <ClientFollowUpCard
            clientId={client.id}
            nextAction={client.nextAction}
            onChange={(nextAction) => {
              setData((d) => ({ ...d, client: { ...d.client, nextAction } }));
              if (!nextAction) reload();
            }}
          />
          <ClientDealsCard clientId={client.id} />
          <Card
            title="Contacts"
            action={
              <Button size="sm" onClick={() => setContactDialog("new")}>
                + Add
              </Button>
            }
          >
            {contacts.length === 0 ? (
              <p className="text-[13px]" style={{ color: INK_MUTED }}>
                No contacts yet. Add the hiring managers you deal with - their email is used for client emails and feedback requests.
              </p>
            ) : (
              <ul className="space-y-4">
                {contacts.map((c) => (
                  <li key={c.id} className="text-[13px]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold" style={{ color: INK }}>
                          {c.name} {c.isPrimary && <Pill color="var(--forest)" background="var(--mint)">Main</Pill>}
                        </p>
                        {c.jobTitle && <p style={{ color: INK_MUTED }}>{c.jobTitle}</p>}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="block underline truncate" style={{ color: INK_MUTED }}>
                            {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="block" style={{ color: INK_MUTED }}>
                            {c.phone}
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2 text-[11px] font-semibold shrink-0">
                        <button type="button" onClick={() => setContactDialog(c)} style={{ color: "var(--forest)" }}>
                          Edit
                        </button>
                        <button type="button" onClick={() => removeContact(c)} style={{ color: INK_FAINT }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <CustomFieldsCard key={client.id} entity="client" recordId={client.id} values={client.customFields} />

          <SignaturesCard
            title="Terms of business"
            kinds={["terms", "other"]}
            signer={contacts.find((c) => c.isPrimary) || contacts[0] ? { name: (contacts.find((c) => c.isPrimary) || contacts[0]).name, email: (contacts.find((c) => c.isPrimary) || contacts[0]).email } : null}
            template={(kind, agencyName) =>
              kind === "terms"
                ? { title: `Terms of business - ${client.name}`, body: termsOfBusinessText({ agencyName, clientName: client.name, feePercent: client.feePercent, paymentTermsDays: client.paymentTermsDays, rebateDays: client.rebateDays, termsNotes: client.termsNotes }) }
                : { title: "", body: "" }
            }
            clientId={client.id}
            onChanged={reload}
          />

          <Card title="Terms" action={<Button size="sm" onClick={() => setEditing(true)}>Edit</Button>}>
            <dl className="text-[13px] space-y-2">
              {[
                ["Fee", client.feePercent != null ? `${client.feePercent}% of salary` : null],
                ["Payment terms", client.paymentTermsDays != null ? `${client.paymentTermsDays} days` : null],
                ["Rebate period", client.rebateDays != null ? `${client.rebateDays} days` : null],
                ["Signed terms", client.termsSignedAt ? formatDateOnly(client.termsSignedAt) : null],
                ["Address", client.address],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt style={{ color: INK_FAINT }}>{k}</dt>
                  <dd className="text-right" style={{ color: v ? INK : INK_FAINT }}>
                    {v || "Not set"}
                  </dd>
                </div>
              ))}
            </dl>
            {client.termsNotes && (
              <p className="text-[12px] mt-3 whitespace-pre-line" style={{ color: INK_MUTED }}>
                {client.termsNotes}
              </p>
            )}
          </Card>
        </div>
      </div>

      {editing && (
        <EditClientDialog
          client={client}
          onClose={closeEdit}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
      {contactDialog && (
        <ContactDialog
          clientId={id}
          contact={contactDialog === "new" ? null : contactDialog}
          onClose={closeContact}
          onSaved={() => {
            setContactDialog(null);
            reload();
          }}
        />
      )}
    </Page>
  );
}
