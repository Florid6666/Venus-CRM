// Same production default and override as auth.ts -- keep them in sync.
const API_URL = process.env.OMNIOS_API_URL ?? "https://crm.venusglobaltech.com/api";

// null = not clocked in right now.
export async function getActiveWorkSession(accessToken: string): Promise<{ id: string } | null> {
  const res = await fetch(`${API_URL}/work-sessions/active`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to check work session (${res.status})`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Uploads straight from the in-memory buffer -- the caller never writes it
// to disk (see main.ts's captureAndUpload). Throws on any non-2xx response,
// including the 409 the backend returns if the employee clocked out between
// the capture and this call -- the caller treats that as a dropped capture,
// not a retryable failure (see main.ts's uploadOne).
export async function uploadCapture(accessToken: string, jpeg: Buffer): Promise<void> {
  const form = new FormData();
  // Wrap in a plain Uint8Array -- Buffer's ArrayBufferLike type includes
  // SharedArrayBuffer, which BlobPart doesn't accept.
  form.append("file", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "capture.jpg");

  const res = await fetch(`${API_URL}/screen-monitoring/captures`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    const err = new Error(body.message ?? `Upload failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

// idleSeconds comes straight from Electron's powerMonitor.getSystemIdleTime()
// (see main.ts) -- an OS-level "seconds since last input" signal, never
// individual key/click events. Same 409-on-clocked-out semantics as
// uploadCapture.
export async function uploadActivityPing(accessToken: string, idleSeconds: number): Promise<void> {
  const res = await fetch(`${API_URL}/activity-monitoring/pings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ idleSeconds }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    const err = new Error(body.message ?? `Activity ping failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

// Uploads a finished screen recording. Same 409-on-clocked-out semantics as
// uploadCapture: the employee clocking out mid-clip is expected, not an error
// worth retrying -- the clip is simply dropped.
export async function uploadRecording(
  accessToken: string,
  webm: Buffer,
  durationSec: number,
): Promise<void> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(webm)], { type: "video/webm" }), "recording.webm");
  form.append("durationSec", String(durationSec));

  const res = await fetch(`${API_URL}/screen-recordings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    const err = new Error(body.message ?? `Recording upload failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
}
