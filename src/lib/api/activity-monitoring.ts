import { apiFetch } from "./client";
import type { PersonRef } from "./types";

export interface ActivitySummaryRow {
  user: PersonRef & { department: { id: string; name: string } | null };
  totalPings: number;
  activePings: number;
  activePercent: number;
}

export interface ActivitySummaryFilters {
  userId?: string;
  from?: string;
  to?: string;
}

function buildQuery(filters: ActivitySummaryFilters): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getActivitySummary(filters: ActivitySummaryFilters = {}) {
  return apiFetch<ActivitySummaryRow[]>(`/activity-monitoring/summary${buildQuery(filters)}`);
}
