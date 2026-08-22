import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  useConnectEmail,
  useDisconnectEmail,
  useEmailConnectionStatus,
  useNetworkDiagnostic,
  useTestEmailConnection,
} from "@/hooks/use-email-connections";
import { ApiError } from "@/lib/api/client";

// Common providers' SMTP settings, so connecting isn't a "go look it up
// yourself" exercise for the two accounts almost everyone actually has.
// "Custom" clears the preset for anything else (a company mail server,
// Zoho, etc.).
const PROVIDER_PRESETS = [
  { label: "Gmail", host: "smtp.gmail.com", port: 465, secure: true },
  { label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, secure: false },
  { label: "Yahoo", host: "smtp.mail.yahoo.com", port: 465, secure: true },
  { label: "Zoho Mail", host: "smtp.zoho.com", port: 465, secure: true },
] as const;

function StatusBadge({ connected, verified }: { connected: boolean; verified: boolean }) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-canvas/50 text-text-dim border-border-subtle">
        <XCircle className="size-3.5" />
        Not connected
      </span>
    );
  }
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-success/15 text-success border-success/20 font-medium">
        <CheckCircle2 className="size-3.5" />
        Connected &amp; verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-destructive/15 text-destructive border-destructive/20 font-medium">
      <AlertCircle className="size-3.5" />
      Connection error
    </span>
  );
}

export function BulkEmailSenderSection() {
  const { data: status, isLoading } = useEmailConnectionStatus();
  const connectEmail = useConnectEmail();
  const testConnection = useTestEmailConnection();
  const disconnectEmail = useDisconnectEmail();
  const networkDiagnostic = useNetworkDiagnostic();

  const [editing, setEditing] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function applyPreset(preset: (typeof PROVIDER_PRESETS)[number]) {
    setSmtpHost(preset.host);
    setSmtpPort(String(preset.port));
    setSmtpSecure(preset.secure);
  }

  function openForm() {
    setError(null);
    if (status?.connected) {
      setSmtpHost(status.smtpHost ?? "");
      setSmtpPort(status.smtpPort ? String(status.smtpPort) : "465");
      setSmtpSecure(status.smtpSecure ?? true);
      setSmtpUsername(status.smtpUsername ?? "");
      setSmtpPassword("");
      setFromName(status.fromName ?? "");
      setFromEmail(status.fromEmail ?? "");
    } else {
      setSmtpHost("");
      setSmtpPort("465");
      setSmtpSecure(true);
      setSmtpUsername("");
      setSmtpPassword("");
      setFromName("");
      setFromEmail("");
    }
    setEditing(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await connectEmail.mutateAsync({
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort),
        smtpSecure,
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword || undefined,
        fromName: fromName.trim() || undefined,
        fromEmail: fromEmail.trim(),
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not connect that email account");
    }
  }

  async function handleTest() {
    setError(null);
    try {
      await testConnection.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not test the connection");
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect this email account? Bulk sends and sequences will stop until you reconnect one.")) {
      return;
    }
    await disconnectEmail.mutateAsync();
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-text-dim" />
          <h2 className="text-sm font-semibold">Bulk Email Sender</h2>
        </div>
        {!isLoading && status && <StatusBadge connected={status.connected} verified={status.verified} />}
      </div>
      <p className="text-xs text-text-dim -mt-2">
        Connect your own mailbox so Bulk Email blasts and Sequence steps send from your real
        address, not a shared company sender. Recipients see (and can reply to) you directly.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-dim py-4">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {!isLoading && !editing && status?.connected && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm bg-canvas/30 border border-border-subtle rounded-lg p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-text-dim">From</p>
              <p className="truncate">
                {status.fromName ? `${status.fromName} <${status.fromEmail}>` : status.fromEmail}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-text-dim">SMTP server</p>
              <p className="truncate">
                {status.smtpHost}:{status.smtpPort} {status.smtpSecure ? "(TLS)" : "(STARTTLS)"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-text-dim">Username</p>
              <p className="truncate">{status.smtpUsername}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-text-dim">Last verified</p>
              <p className="truncate">
                {status.lastVerifiedAt ? new Date(status.lastVerifiedAt).toLocaleString() : "Never"}
              </p>
            </div>
          </div>
          {!status.verified && status.lastError && (
            <p className="text-xs text-destructive">{status.lastError}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!status.verified && <NetworkDiagnosticPanel diagnostic={networkDiagnostic} />}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testConnection.isPending}
              className="gap-1.5"
            >
              {testConnection.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Test connection
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={openForm} className="gap-1.5">
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={handleDisconnect}
              disabled={disconnectEmail.isPending}
            >
              {disconnectEmail.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {!isLoading && !editing && !status?.connected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 bg-canvas/30 border border-border-subtle rounded-lg p-4">
            <p className="text-sm text-text-dim">
              {status?.httpFallbackAvailable
                ? "No mailbox connected yet -- sends will use a shared address for now, with replies routed back to you. Connect your own mailbox to send as yourself instead."
                : "No email connected yet. Bulk campaigns and sequences can't send until you connect one."}
            </p>
            <Button type="button" size="sm" onClick={openForm} className="gap-1.5 shrink-0">
              <Send className="size-3.5" />
              Connect email
            </Button>
          </div>
          <ConnectHelp />
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <ConnectHelp />
          <div className="flex flex-wrap gap-1.5">
            {PROVIDER_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-[11px] px-2 py-1 rounded-full border border-border-subtle bg-canvas/40 hover:bg-canvas/70 text-text-dim hover:text-foreground transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-host">SMTP host</Label>
              <Input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2.5">
            <div>
              <Label htmlFor="smtp-secure" className="text-sm">
                Use TLS
              </Label>
              <p className="text-[11px] text-text-dim">On for port 465, off for 587/STARTTLS.</p>
            </div>
            <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp-username">Username</Label>
            <Input
              id="smtp-username"
              value={smtpUsername}
              onChange={(e) => setSmtpUsername(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-password">Password</Label>
            <Input
              id="smtp-password"
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder={status?.connected ? "Leave blank to keep current password" : undefined}
              required={!status?.connected}
            />
            <p className="text-[11px] text-text-dim">
              Gmail and Outlook require an app password, not your normal login password, when
              2-step verification is on.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-from-name">From name (optional)</Label>
              <Input id="smtp-from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-from-email">From email</Label>
              <Input
                id="smtp-from-email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {error && <NetworkDiagnosticPanel diagnostic={networkDiagnostic} />}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={connectEmail.isPending} className="gap-1.5">
              {connectEmail.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {connectEmail.isPending ? "Verifying…" : "Connect & verify"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// Surfaces the raw-TCP diagnostic (see email-connections.controller.ts's
// network-diagnostic endpoint) right next to a Connect/Test failure --
// distinguishes "this server can't reach any mail provider" (a network-level
// block on this host) from "it can reach others fine, just not this one"
// (more likely an account-level block on the provider's side, e.g. an
// unrecognized-IP sign-in block) without needing a developer involved.
function NetworkDiagnosticPanel({
  diagnostic,
}: {
  diagnostic: ReturnType<typeof useNetworkDiagnostic>;
}) {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => diagnostic.mutate()}
        disabled={diagnostic.isPending}
        className="gap-1.5"
      >
        {diagnostic.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Wifi className="size-3.5" />
        )}
        Test server network
      </Button>
      {diagnostic.data && (
        <div className="text-xs bg-canvas/30 border border-border-subtle rounded-lg p-3 space-y-1">
          {diagnostic.data.map((r) => (
            <div key={`${r.host}:${r.port}`} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {r.ok ? (
                  <CheckCircle2 className="size-3 text-success shrink-0" />
                ) : (
                  <XCircle className="size-3 text-destructive shrink-0" />
                )}
                {r.label}
              </span>
              <span className="text-text-dim">{r.ok ? `${r.ms}ms` : r.error ?? "failed"}</span>
            </div>
          ))}
          <p className="text-[11px] text-text-dim pt-1">
            If Zoho fails here but Gmail/Outlook succeed, this server can reach the internet fine --
            it's most likely Zoho blocking this specific connection (check its blocked-sign-in /
            security-alert settings). If everything fails, this server's own outbound network is
            blocked.
          </p>
        </div>
      )}
    </div>
  );
}

// Plain-language walkthroughs for the two accounts almost everyone actually
// has. The password these steps produce is a one-time generated code, not
// the person's real inbox password -- worth spelling out since typing your
// normal password is the instinctive (and wrong) first try.
function ConnectHelp() {
  return (
    <div className="border border-border-subtle rounded-lg bg-canvas/20 px-4">
      <Accordion type="single" collapsible>
        <AccordionItem value="help" className="border-b-0">
          <AccordionTrigger className="text-xs font-medium hover:no-underline py-3">
            <span className="flex items-center gap-1.5 text-text-dim">
              <HelpCircle className="size-3.5" />
              Not sure how to connect your email? Start here.
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-text-dim mb-3">
              You'll need a special <span className="font-medium text-foreground">app password</span> --
              a one-time code your email provider generates just for this, separate from the
              password you normally sign in with. Your regular password won't work here and
              Google/Microsoft will reject it.
            </p>
            <Accordion type="single" collapsible className="space-y-2">
              <AccordionItem value="gmail" className="border border-border-subtle rounded-lg px-3">
                <AccordionTrigger className="text-xs py-2.5 hover:no-underline">Gmail</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-text-dim">
                    <li>
                      Go to <span className="font-medium text-foreground">myaccount.google.com</span> and
                      sign in.
                    </li>
                    <li>
                      Click <span className="font-medium text-foreground">Security</span> on the left.
                    </li>
                    <li>
                      Under "How you sign in to Google", turn on{" "}
                      <span className="font-medium text-foreground">2-Step Verification</span> if it isn't
                      on already (Google won't let you make an app password without it).
                    </li>
                    <li>
                      Go back to <span className="font-medium text-foreground">Security</span>, open{" "}
                      <span className="font-medium text-foreground">2-Step Verification</span> again, and
                      scroll down to <span className="font-medium text-foreground">App passwords</span>.
                    </li>
                    <li>
                      Type a name like "Venus CRM" and click{" "}
                      <span className="font-medium text-foreground">Create</span>.
                    </li>
                    <li>Google shows you a 16-letter code in a yellow box. Copy it.</li>
                    <li>
                      Back here: <span className="font-medium text-foreground">Username</span> is your full
                      Gmail address, <span className="font-medium text-foreground">Password</span> is that
                      code you just copied.
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="outlook" className="border border-border-subtle rounded-lg px-3">
                <AccordionTrigger className="text-xs py-2.5 hover:no-underline">
                  Outlook / Microsoft 365
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-text-dim">
                    <li>
                      Go to <span className="font-medium text-foreground">account.microsoft.com</span> and
                      sign in.
                    </li>
                    <li>
                      Click <span className="font-medium text-foreground">Security</span> at the top.
                    </li>
                    <li>
                      Make sure <span className="font-medium text-foreground">Two-step verification</span> is
                      turned on.
                    </li>
                    <li>
                      Click <span className="font-medium text-foreground">Advanced security options</span>.
                    </li>
                    <li>
                      Under <span className="font-medium text-foreground">App passwords</span>, click{" "}
                      <span className="font-medium text-foreground">Create a new app password</span>.
                    </li>
                    <li>Microsoft shows you a generated password. Copy it.</li>
                    <li>
                      Back here: <span className="font-medium text-foreground">Username</span> is your full
                      Outlook/Microsoft email address,{" "}
                      <span className="font-medium text-foreground">Password</span> is that code you just
                      copied.
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="other" className="border border-border-subtle rounded-lg px-3">
                <AccordionTrigger className="text-xs py-2.5 hover:no-underline">
                  Using a different email provider (company email, Zoho, etc.)
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-text-dim">
                    Ask whoever set up your email (IT, or the provider's support site) for your{" "}
                    <span className="font-medium text-foreground">SMTP server address and port</span> and
                    whether an app password is required. If your regular password works, you can use
                    that instead -- just leave the SMTP host/port fields matching what they gave you.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
