"use client";

// Dashboard API calls: clients (re-exported by lib/dashboard-api.js).

import { apiFetch } from "./core";

// Clients and contacts - see app/api/clients.
export async function getClients() {
  const res = await apiFetch("/api/clients");
  return res.clients;
}

export async function getClient(id) {
  return apiFetch(`/api/clients/${id}`);
}

export async function createClient(fields) {
  const res = await apiFetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.client;
}

export async function updateClient(id, fields) {
  const res = await apiFetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.client;
}

export async function deleteClient(id) {
  return apiFetch(`/api/clients/${id}`, { method: "DELETE" });
}

export async function addClientContact(clientId, fields) {
  const res = await apiFetch(`/api/clients/${clientId}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return res.contact;
}

export async function updateClientContact(clientId, contactId, fields) {
  const res = await apiFetch(`/api/clients/${clientId}/contacts`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactId, ...fields }),
  });
  return res.contact;
}

export async function removeClientContact(clientId, contactId) {
  return apiFetch(`/api/clients/${clientId}/contacts?contactId=${encodeURIComponent(contactId)}`, { method: "DELETE" });
}

export async function logClientActivity(clientId, type, note) {
  return apiFetch(`/api/clients/${clientId}/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, note }),
  });
}

// A follow-up on a client: { label, dueAt } to set, { completed: true } when done.
export async function setClientNextAction(clientId, body) {
  const res = await apiFetch(`/api/clients/${clientId}/next-action`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.nextAction;
}
