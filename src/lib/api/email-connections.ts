import { apiFetch } from "./client";
import type { EmailConnectionStatus, NetworkDiagnosticResult } from "./types";

export interface ConnectEmailInput {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  // Optional on update -- omitting it keeps the password already on file
  // (see EmailConnectionsService.connect on the backend).
  smtpPassword?: string;
  fromName?: string;
  fromEmail: string;
}

export function getEmailConnectionStatus() {
  return apiFetch<EmailConnectionStatus>("/email-connections/me");
}

export function connectEmail(input: ConnectEmailInput) {
  return apiFetch<EmailConnectionStatus>("/email-connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function testEmailConnection() {
  return apiFetch<EmailConnectionStatus>("/email-connections/test", { method: "POST" });
}

export function disconnectEmail() {
  return apiFetch<void>("/email-connections", { method: "DELETE" });
}

// Raw TCP reachability to a fixed set of known mail providers from the
// server itself -- lets a "connection timeout" be diagnosed as a
// network-level block (this server can't reach the host at all) vs an
// account-level one (host is reachable, so it's credentials/provider-side).
export function getNetworkDiagnostic() {
  return apiFetch<NetworkDiagnosticResult[]>("/email-connections/network-diagnostic");
}
