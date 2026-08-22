import { apiFetch } from "./client";
import type { WorkSession } from "./types";

export function listWorkSessions(userId?: string) {
  const qs = userId ? `?userId=${userId}` : "";
  return apiFetch<WorkSession[]>(`/work-sessions${qs}`);
}

export async function getActiveWorkSession() {
  // The endpoint returns null when there's no open session; Nest serializes
  // that as an empty body, which apiFetch surfaces as undefined. Coerce back to
  // null so React Query doesn't warn about an undefined query result.
  return (await apiFetch<WorkSession | null>("/work-sessions/active")) ?? null;
}

export function clockIn() {
  return apiFetch<WorkSession>("/work-sessions/clock-in", { method: "POST" });
}

export function clockOut() {
  return apiFetch<WorkSession>("/work-sessions/clock-out", { method: "POST" });
}
