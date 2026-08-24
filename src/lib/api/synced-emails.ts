import { apiFetch } from "./client";
import type { SyncedEmail } from "./types";

export interface SyncedEmailFilters {
  contactId?: string;
  dealId?: string;
}

function buildQuery(filters: SyncedEmailFilters): string {
  const params = new URLSearchParams();
  if (filters.contactId) params.set("contactId", filters.contactId);
  if (filters.dealId) params.set("dealId", filters.dealId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listSyncedEmails(filters: SyncedEmailFilters = {}) {
  return apiFetch<SyncedEmail[]>(`/synced-emails${buildQuery(filters)}`);
}

export function markSyncedEmailRead(id: string) {
  return apiFetch<SyncedEmail>(`/synced-emails/${id}/read`, { method: "PATCH" });
}
