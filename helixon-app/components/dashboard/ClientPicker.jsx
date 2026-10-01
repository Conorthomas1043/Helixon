"use client";

// Client + hiring contact for a job. Type to pick one of the agency's
// clients (or a new name, which becomes a client when the job is saved -
// lib/clients.js ensureClient), then choose who the contact is there.
//
// value / onChange: { clientId, clientName, contactId, contactEmail }

import { useEffect, useId, useMemo, useState } from "react";
import { getClients, getClient } from "@/lib/dashboard-api";
import { Field, TextInput, Select } from "@/components/dashboard/ui";

export default function ClientPicker({ value, onChange }) {
  const listId = useId();
  const [clients, setClients] = useState([]);
  const [contactsFor, setContactsFor] = useState({ clientId: null, contacts: [] });

  // Loaded once. A preset clientId with no name (a "New job" link from a
  // client's page) gets its name filled in from the list.
  useEffect(() => {
    getClients()
      .then((list) => {
        setClients(list);
        if (value.clientId && !value.clientName) {
          const match = list.find((c) => c.id === value.clientId);
          if (match) onChange({ ...value, clientName: match.name });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    if (!value.clientId) return;
    let cancelled = false;
    getClient(value.clientId)
      .then((d) => {
        if (!cancelled) setContactsFor({ clientId: value.clientId, contacts: d.contacts ?? [] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value.clientId]);

  const byName = useMemo(() => new Map(clients.map((c) => [c.name.toLowerCase(), c])), [clients]);
  const contacts = contactsFor.clientId === value.clientId ? contactsFor.contacts : [];

  function typeName(name) {
    const match = byName.get(name.trim().toLowerCase());
    onChange({ clientId: match?.id ?? null, clientName: name, contactId: null, contactEmail: null });
  }

  const isNew = value.clientName?.trim() && !value.clientId;

  return (
    <>
      <Field label="Client" hint={isNew ? `"${value.clientName.trim()}" will be added to your clients.` : null}>
        <TextInput list={listId} maxLength={200} value={value.clientName ?? ""} onChange={(e) => typeName(e.target.value)} placeholder="Start typing a client…" />
        <datalist id={listId}>
          {clients.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Hiring contact">
        <Select
          value={value.contactId ?? ""}
          disabled={!value.clientId}
          onChange={(e) => {
            const contact = contacts.find((c) => c.id === e.target.value);
            onChange({ ...value, contactId: contact?.id ?? null, contactEmail: contact?.email ?? null });
          }}
          options={[
            { value: "", label: value.clientId ? (contacts.length ? "No contact" : "No contacts yet - add them on the client") : "Pick a client first" },
            ...contacts.map((c) => ({ value: c.id, label: `${c.name}${c.jobTitle ? ` · ${c.jobTitle}` : ""}${c.email ? "" : " (no email)"}` })),
          ]}
        />
      </Field>
    </>
  );
}
