import { apiFetch } from "./client";
import type { RoleName, UserSummary } from "./types";

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  githubUsername?: string | null;
  role: RoleName;
  departmentId?: string | null;
  managerId?: string | null;
  monthlyTarget?: number | null;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, "email" | "password">> & {
  password?: string;
  isActive?: boolean;
};

// Self-service: the current user editing their own profile. Email is never
// changeable and password goes through the emailed reset flow, so neither is
// here.
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

export function updateMyProfile(input: UpdateProfileInput) {
  return apiFetch<UserSummary>("/users/me", { method: "PATCH", body: JSON.stringify(input) });
}

export function listUsers() {
  return apiFetch<UserSummary[]>("/users");
}

export function createUser(input: CreateUserInput) {
  return apiFetch<UserSummary>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(id: string, input: UpdateUserInput) {
  return apiFetch<UserSummary>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function updateUserTarget(id: string, monthlyTarget: number | null) {
  return apiFetch<UserSummary>(`/users/${id}/target`, {
    method: "PATCH",
    body: JSON.stringify({ monthlyTarget }),
  });
}

export function updateUserGithubUsername(id: string, githubUsername: string | null) {
  return apiFetch<UserSummary>(`/users/${id}/github-username`, {
    method: "PATCH",
    body: JSON.stringify({ githubUsername }),
  });
}

export function deleteUser(id: string) {
  return apiFetch<UserSummary>(`/users/${id}`, { method: "DELETE" });
}
