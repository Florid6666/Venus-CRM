import { apiFetch } from "./client";
import type { PersonRef } from "./types";

export interface ScreenRecording {
  id: string;
  startedAt: string;
  durationSec: number;
  sizeBytes: number;
  user: PersonRef & { department: { id: string; name: string } | null };
}

export interface ScreenRecordingFilters {
  userId?: string;
  from?: string;
  to?: string;
}

function buildQuery(filters: ScreenRecordingFilters): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listScreenRecordings(filters: ScreenRecordingFilters = {}) {
  return apiFetch<ScreenRecording[]>(`/screen-recordings${buildQuery(filters)}`);
}

export function deleteScreenRecording(id: string) {
  return apiFetch<void>(`/screen-recordings/${id}`, { method: "DELETE" });
}
