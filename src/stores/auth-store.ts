import { create } from "zustand";

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: {
    id: string;
    name: "ADMIN" | "MANAGER" | "EMPLOYEE";
  };
  // Drives department-scoped display (e.g. "Sales Manager", "Dev Head") and
  // the admin-only /admin/settings route guard's role check elsewhere.
  department: {
    id: string;
    name: string;
    managerTitle: string;
  } | null;
}

interface AuthState {
  user: CurrentUser | null;
  accessToken: string | null;
  status: "idle" | "authenticated" | "unauthenticated";
  setAuth: (user: CurrentUser, accessToken: string) => void;
  // Patch the in-memory current user (e.g. after a self-service profile edit)
  // without re-authenticating -- keeps the sidebar name/email in sync.
  patchUser: (patch: Partial<CurrentUser>) => void;
  clearAuth: () => void;
}

// No persist middleware: the access token is deliberately kept in memory only
// (never localStorage/sessionStorage) to limit XSS exposure. A hard reload
// re-derives it via the httpOnly refresh cookie (see the _app route guard).
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "idle",
  setAuth: (user, accessToken) => set({ user, accessToken, status: "authenticated" }),
  patchUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : {})),
  clearAuth: () => set({ user: null, accessToken: null, status: "unauthenticated" }),
}));
