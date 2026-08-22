import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  // Set on requests that should never trigger a silent-refresh retry: the
  // three public auth endpoints themselves, to avoid refresh-on-login-failure
  // and infinite refresh loops.
  skipAuthRetry?: boolean;
}

async function rawFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const { skipAuthRetry: _skip, ...init } = options;
  const token = useAuthStore.getState().accessToken;

  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await rawFetch("/auth/refresh", { method: "POST", skipAuthRetry: true });
    if (res.status === 401) {
      // The server genuinely rejected this session (refresh token really
      // expired/revoked, or the account was deactivated) -- only now is
      // signing out correct.
      useAuthStore.getState().clearAuth();
      return false;
    }
    if (!res.ok) {
      // Transient server failure (5xx, etc.) -- don't destroy a perfectly
      // good session over a momentary hiccup. The failing call just fails
      // this once; the next one retries normally.
      return false;
    }
    const data = await res.json();
    useAuthStore.getState().setAuth(data.user, data.accessToken);
    return true;
  } catch {
    // Network-level failure (no response reached at all) -- most commonly
    // the device just woke from sleep and isn't back online yet. Never
    // treat losing network as being logged out.
    return false;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, options);
    }
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }

  return body as T;
}

// Multipart upload. Deliberately does NOT set Content-Type: the browser has
// to write the multipart boundary itself, which is why this can't just be
// apiFetch with a FormData body.
export async function apiUploadForm<T>(path: string, form: FormData): Promise<T> {
  const send = () => {
    const token = useAuthStore.getState().accessToken;
    return fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  };

  let res = await send();
  if (res.status === 401 && (await tryRefresh())) {
    res = await send();
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }
  return body as T;
}

// For binary responses (e.g. a screen-capture image) that can't go through
// apiFetch's JSON parsing -- same auth-header + silent-refresh-retry behavior.
export async function apiFetchBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, options);
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }

  return res.blob();
}
