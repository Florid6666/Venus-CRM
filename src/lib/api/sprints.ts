import { apiFetch } from "./client";
import type { Sprint } from "./types";

export interface CreateSprintInput {
  name: string;
  startDate: string;
  endDate: string;
  status: "PLANNING" | "ACTIVE" | "COMPLETED";
}

export function listSprints() {
  return apiFetch<Sprint[]>("/sprints");
}

export function createSprint(input: CreateSprintInput) {
  return apiFetch<Sprint>("/sprints", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSprint(id: string, input: Partial<CreateSprintInput>) {
  return apiFetch<Sprint>(`/sprints/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function assignTasksToSprint(id: string, taskIds: string[]) {
  return apiFetch<Sprint>(`/sprints/${id}/tasks`, {
    method: "POST",
    body: JSON.stringify({ taskIds }),
  });
}
