import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Github,
  Loader2,
  Settings as SettingsIcon,
  CalendarDays,
  Clock,
  Check,
  X,
  Users2,
  BarChart3,
  Rocket,
  MailX,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAdminGuard } from "@/hooks/use-admin-guard";
import { useAppSettings, useUpdateAppSettings } from "@/hooks/use-app-settings";
import {
  useConnectGithub,
  useDisconnectGithub,
  useGithubConnection,
  useTestGithubConnection,
} from "@/hooks/use-github";
import { useApolloConnection, useConnectApollo, useDisconnectApollo } from "@/hooks/use-apollo";
import {
  useEmailSuppressions,
  useAddEmailSuppression,
  useRemoveEmailSuppression,
} from "@/hooks/use-email-suppression";
import { useLeaveRequests, useLeaveStats, useUpdateLeaveRequest } from "@/hooks/use-leave-requests";
import { ApiError } from "@/lib/api/client";
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_LABELS,
} from "@/lib/api/types";

export const Route = createFileRoute("/_app/admin/settings")({
  component: AdminSettingsPage,
});

const SCAFFOLD_FEATURES = [
  "Company profile",
  "Users & roles (RBAC)",
  "Permissions",
  "API keys & webhooks",
  "Email templates",
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  APPROVED: "bg-success/15 text-success border-success/20",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/20",
  CANCELLED: "bg-muted text-text-dim border-border-subtle",
};

function AdminSettingsPage() {
  useAdminGuard();

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <SettingsIcon className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-text-dim mt-1 max-w-2xl">
            Company, users, roles, permissions, integrations, leave management, and API keys.
          </p>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="general">
            <SettingsIcon className="size-3.5 mr-1.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="leave-admin">
            <CalendarDays className="size-3.5 mr-1.5" />
            Leave Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <GeneralSettingsTab />
        </TabsContent>

        <TabsContent value="leave-admin" className="mt-6">
          <LeaveAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── General Settings Tab (existing content) ──────────────────────────────────

function GeneralSettingsTab() {
  const { data: appSettings, isLoading } = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();

  const [heroTagline, setHeroTagline] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (appSettings) {
      setHeroTagline(appSettings.heroTagline ?? "");
    }
  }, [appSettings]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    await updateAppSettings.mutateAsync({ heroTagline: heroTagline.trim() || null });
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Dashboard Hero</h2>
          <p className="text-xs text-text-dim mt-0.5">
            The message shown under everyone's greeting on the main Dashboard.
          </p>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-dim">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 max-w-xl">
            <div className="space-y-1.5">
              <Label htmlFor="hero-tagline">Tagline</Label>
              <Textarea
                id="hero-tagline"
                value={heroTagline}
                onChange={(e) => {
                  setHeroTagline(e.target.value);
                  setSaved(false);
                }}
                maxLength={280}
                rows={2}
                placeholder="Welcome back to Venus CRM."
              />
              <p className="text-[10px] text-text-dim">{heroTagline.length}/280</p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={updateAppSettings.isPending}>
                {updateAppSettings.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
              {saved && !updateAppSettings.isPending && (
                <span className="text-xs text-success">Saved — visible to everyone now.</span>
              )}
            </div>
          </form>
        )}
      </div>

      <GithubConnectionSection />

      <ApolloConnectionSection />

      <EmailSuppressionSection />

      <div className="bg-panel border border-border-subtle rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-dim">
            Module scaffold · Ready to build
          </span>
        </div>
        <p className="text-sm text-foreground/85 mb-5 max-w-2xl">
          The route, navigation, and design system are wired up. Pick a feature
          below and I'll build it out with real components and data.
        </p>
        <ul className="grid sm:grid-cols-2 gap-2">
          {SCAFFOLD_FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-center gap-2.5 rounded-md border border-border-subtle bg-canvas/50 px-3 py-2 text-sm"
            >
              <span className="size-1.5 rounded-full bg-primary/60" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Leave Admin Tab ──────────────────────────────────────────────────────────

function LeaveAdminTab() {
  const { data: stats, isLoading: statsLoading } = useLeaveStats();
  const { data: allLeaves, isLoading: leavesLoading } = useLeaveRequests({ status: "PENDING" });
  const updateLeave = useUpdateLeaveRequest();

  async function handleAction(id: string, action: "APPROVED" | "REJECTED") {
    await updateLeave.mutateAsync({ id, input: { status: action } });
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsLoading ? (
          <div className="col-span-4 flex items-center gap-2 text-sm text-text-dim py-4">
            <Loader2 className="size-4 animate-spin" /> Loading stats…
          </div>
        ) : stats ? (
          <>
            {[
              { label: "Total Requests", value: stats.total, icon: BarChart3, color: "text-primary bg-primary/10" },
              { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-500 bg-amber-500/10" },
              { label: "Approved", value: stats.approved, icon: Check, color: "text-success bg-success/10" },
              { label: "Rejected", value: stats.rejected, icon: X, color: "text-destructive bg-destructive/10" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-panel border border-border-subtle rounded-xl p-4 flex items-center gap-3">
                <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${color}`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-text-dim">{label}</p>
                </div>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {/* Leave type breakdown */}
      {stats && stats.byType.length > 0 && (
        <div className="bg-panel border border-border-subtle rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold">Breakdown by Type</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {stats.byType.map(({ type, count }) => (
              <div key={type} className="flex items-center gap-2.5 rounded-lg border border-border-subtle p-3">
                <span
                  className="size-3 rounded-sm shrink-0"
                  style={{ backgroundColor: LEAVE_TYPE_COLORS[type] }}
                />
                <span className="text-sm flex-1">{LEAVE_TYPE_LABELS[type]}</span>
                <span className="font-semibold text-sm">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending requests table */}
      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
          <Clock className="size-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Pending Approvals</h3>
          {allLeaves && (
            <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-medium">
              {allLeaves.length}
            </span>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leavesLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-text-dim py-8">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!leavesLoading && (!allLeaves || allLeaves.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-text-dim">
                    <CheckCircle2 className="size-8 text-success opacity-60" />
                    <p className="text-sm">No pending leave requests — you're all caught up!</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {(allLeaves ?? []).map((leave) => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
              const submitted = new Date(leave.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              });

              return (
                <TableRow key={leave.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">
                          {leave.user.firstName[0]}{leave.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {leave.user.firstName} {leave.user.lastName}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: LEAVE_TYPE_COLORS[leave.type] }}
                      />
                      {LEAVE_TYPE_LABELS[leave.type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">
                    {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">
                    {end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">{days}d</TableCell>
                  <TableCell className="text-sm text-text-dim max-w-[160px] truncate">
                    {leave.reason ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">{submitted}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1"
                        onClick={() => handleAction(leave.id, "APPROVED")}
                        disabled={updateLeave.isPending}
                      >
                        <Check className="size-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleAction(leave.id, "REJECTED")}
                        disabled={updateLeave.isPending}
                      >
                        <X className="size-3" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── GitHub Connection (existing, unchanged) ──────────────────────────────────

function GithubConnectionSection() {
  const { data: connection, isLoading } = useGithubConnection();
  const connectGithub = useConnectGithub();
  const testGithub = useTestGithubConnection();
  const disconnectGithub = useDisconnectGithub();

  const [accountLogin, setAccountLogin] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (connection?.connected) {
      setAccountLogin(connection.accountLogin ?? "");
    }
  }, [connection]);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await connectGithub.mutateAsync({ accountType: "ORG", accountLogin: accountLogin.trim(), token: token.trim() });
      setToken("");
      setNotice(`Connected to ${accountLogin.trim()}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not connect to GitHub");
    }
  }

  async function handleTest() {
    setError(null);
    setNotice(null);
    try {
      const res = await testGithub.mutateAsync();
      setNotice(`Connection to ${res.accountLogin} is healthy.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connection test failed");
    }
  }

  async function handleDisconnect() {
    setError(null);
    setNotice(null);
    try {
      await disconnectGithub.mutateAsync();
      setToken("");
      setAccountLogin("");
    } catch {
      setError("Could not disconnect");
    }
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-2.5">
        <Github className="size-5 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">GitHub Connection</h2>
          <p className="text-xs text-text-dim mt-0.5 max-w-xl">
            Connect your company's GitHub organization. Once connected, every new project
            automatically gets a private repo, and adding a teammate invites their linked
            GitHub account as a collaborator.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-dim">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : connection?.connected ? (
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2">
            <CheckCircle2 className="size-4 text-success shrink-0" />
            <span className="text-sm">
              Connected to organization <span className="font-semibold">{connection.accountLogin}</span>
              {connection.connectedByEmail ? (
                <span className="text-text-dim"> · by {connection.connectedByEmail}</span>
              ) : null}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleTest} disabled={testGithub.isPending}>
              {testGithub.isPending ? <Loader2 className="size-4 animate-spin" /> : "Test connection"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDisconnect}
              disabled={disconnectGithub.isPending}
            >
              {disconnectGithub.isPending ? <Loader2 className="size-4 animate-spin" /> : "Disconnect"}
            </Button>
          </div>
          <p className="text-[11px] text-text-dim">
            To rotate the token, just connect again with a new one below.
          </p>
          <form onSubmit={handleConnect} className="space-y-3 border-t border-border-subtle pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="gh-org">Organization</Label>
              <Input id="gh-org" value={accountLogin} onChange={(e) => setAccountLogin(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gh-token">New access token</Label>
              <Input
                id="gh-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_… (classic PAT with 'repo' scope)"
                required
              />
            </div>
            <Button type="submit" disabled={connectGithub.isPending}>
              {connectGithub.isPending ? <Loader2 className="size-4 animate-spin" /> : "Reconnect"}
            </Button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3 max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="gh-org">Organization name</Label>
            <Input
              id="gh-org"
              value={accountLogin}
              onChange={(e) => setAccountLogin(e.target.value)}
              placeholder="your-company"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-token">Personal access token</Label>
            <Input
              id="gh-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_… (classic PAT with 'repo' scope)"
              required
            />
            <p className="text-[11px] text-text-dim">
              Create a classic token at github.com/settings/tokens with the <code>repo</code> scope,
              owned by an org member who can create repos. It's verified against GitHub before saving,
              and stored encrypted.
            </p>
          </div>
          <Button type="submit" disabled={connectGithub.isPending}>
            {connectGithub.isPending ? <Loader2 className="size-4 animate-spin" /> : "Connect GitHub"}
          </Button>
        </form>
      )}

      {notice && <p className="text-sm text-success">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ─── Apollo.io Connection ──────────────────────────────────────────────────────

function ApolloConnectionSection() {
  const { data: connection, isLoading } = useApolloConnection();
  const connectApollo = useConnectApollo();
  const disconnectApollo = useDisconnectApollo();

  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await connectApollo.mutateAsync(apiKey.trim());
      setApiKey("");
      setNotice("Apollo connected — the Sales team can now find and enrich leads.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not connect to Apollo");
    }
  }

  async function handleDisconnect() {
    setError(null);
    setNotice(null);
    try {
      await disconnectApollo.mutateAsync();
      setApiKey("");
    } catch {
      setError("Could not disconnect");
    }
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-2.5">
        <Rocket className="size-5 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">Apollo.io Connection</h2>
          <p className="text-xs text-text-dim mt-0.5 max-w-xl">
            Connect Apollo.io so the Sales team can search for leads, import them
            into the CRM, and enrich existing contacts from the Outreach page.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-dim">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : connection?.connected ? (
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2">
            <CheckCircle2 className="size-4 text-success shrink-0" />
            <span className="text-sm">
              Connected
              {connection.connectedByName ? (
                <span className="text-text-dim"> · by {connection.connectedByName}</span>
              ) : null}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleDisconnect}
            disabled={disconnectApollo.isPending}
          >
            {disconnectApollo.isPending ? <Loader2 className="size-4 animate-spin" /> : "Disconnect"}
          </Button>
          <p className="text-[11px] text-text-dim">
            To rotate the key, just connect again with a new one below.
          </p>
          <form onSubmit={handleConnect} className="space-y-3 border-t border-border-subtle pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="apollo-key">New API key</Label>
              <Input
                id="apollo-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Apollo API key"
                required
              />
            </div>
            <Button type="submit" disabled={connectApollo.isPending}>
              {connectApollo.isPending ? <Loader2 className="size-4 animate-spin" /> : "Reconnect"}
            </Button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3 max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="apollo-key">API key</Label>
            <Input
              id="apollo-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Apollo API key"
              required
            />
            <p className="text-[11px] text-text-dim">
              Find this under Settings → API in your Apollo.io account. It's
              verified against Apollo before saving, and stored encrypted.
            </p>
          </div>
          <Button type="submit" disabled={connectApollo.isPending}>
            {connectApollo.isPending ? <Loader2 className="size-4 animate-spin" /> : "Connect Apollo"}
          </Button>
        </form>
      )}

      {notice && <p className="text-sm text-success">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ─── Email Suppression List ────────────────────────────────────────────────────

function EmailSuppressionSection() {
  const { data: suppressions, isLoading } = useEmailSuppressions();
  const addSuppression = useAddEmailSuppression();
  const removeSuppression = useRemoveEmailSuppression();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addSuppression.mutateAsync(email.trim());
      setEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add suppression");
    }
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-2.5">
        <MailX className="size-5 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">Email Suppression List</h2>
          <p className="text-xs text-text-dim mt-0.5 max-w-xl">
            Addresses that must never receive outreach email again — populated
            automatically when someone unsubscribes, or added manually here.
            Removing an entry is Admin-only.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-2 max-w-md">
        <div className="space-y-1.5 flex-1">
          <Label htmlFor="suppress-email">Suppress an address</Label>
          <Input
            id="suppress-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="someone@example.com"
            required
          />
        </div>
        <Button type="submit" disabled={addSuppression.isPending} className="gap-1.5">
          {addSuppression.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-text-dim py-6">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && suppressions?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-text-dim py-6">
                  No suppressed addresses.
                </TableCell>
              </TableRow>
            )}
            {suppressions?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-sm">{s.email}</TableCell>
                <TableCell className="text-sm text-text-dim">{s.reason}</TableCell>
                <TableCell className="text-sm text-text-dim">
                  {new Date(s.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => removeSuppression.mutate(s.id)}
                    disabled={removeSuppression.isPending}
                    className="text-text-dim hover:text-destructive transition-colors"
                    title="Remove from suppression list"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
