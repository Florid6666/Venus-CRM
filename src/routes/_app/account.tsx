import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Loader2,
  UserCircle2,
  Github,
  KeyRound,
  CheckCircle2,
  CalendarDays,
  Clock,
  Check,
  X,
  Plus,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUsers, useUpdateMyProfile, useUpdateGithubUsername } from "@/hooks/use-users";
import { useRequestPasswordReset } from "@/hooks/use-auth";
import { useLeaveRequests, useUpdateLeaveRequest } from "@/hooks/use-leave-requests";
import { useAuthStore } from "@/stores/auth-store";
import { getRoleLabel } from "@/lib/role-label";
import { ApiError } from "@/lib/api/client";
import { LeaveRequestFormDialog } from "@/components/leave-request-form-dialog";
import { LeaveCalendar } from "@/components/leave-calendar";
import { BulkEmailSenderSection } from "@/components/bulk-email-sender-section";
import { EmailSignatureEditor } from "@/components/email-signature-editor";
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, LEAVE_STATUS_LABELS } from "@/lib/api/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
  // Set by EmailOAuthController's callback redirect (a plain top-level
  // navigation, so this is the only way it can hand back a result).
  validateSearch: (search: Record<string, unknown>): { emailConnect?: string } => ({
    emailConnect: typeof search.emailConnect === "string" ? search.emailConnect : undefined,
  }),
});

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  APPROVED: "bg-success/15 text-success border-success/20",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/20",
  CANCELLED: "bg-muted text-text-dim border-border-subtle",
};

function AccountPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: users } = useUsers();
  const me = useMemo(() => users?.find((u) => u.id === currentUser?.id), [users, currentUser]);
  const { emailConnect } = Route.useSearch();

  useEffect(() => {
    if (emailConnect === "success") {
      toast.success("Mailbox connected -- sent and received mail will start syncing shortly.");
    } else if (emailConnect === "denied") {
      toast.error("Mailbox connection was cancelled.");
    } else if (emailConnect === "error") {
      toast.error("Couldn't connect that mailbox -- try again.");
    }
    // Only meant to fire once per redirect landing, not on every render.
  }, [emailConnect]);

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <UserCircle2 className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Account</h1>
          <p className="text-sm text-text-dim mt-1">
            Update your personal details, password, and leave history.
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <UserCircle2 className="size-3.5 mr-1.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="my-leaves">
            <CalendarDays className="size-3.5 mr-1.5" />
            My Leaves
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <ProfileSection meLoaded={!!me} email={me?.email ?? currentUser?.email ?? ""} />
          {/* GitHub linking only does anything for Dev (repo collaborator
              invites, commit/PR attribution) -- see github.service.ts /
              webhooks.service.ts. Not shown for other departments. */}
          {me?.department?.name === "Dev" && (
            <GithubSection userId={currentUser?.id} initial={me?.githubUsername ?? ""} />
          )}
          {/* Only relevant to Sales -- same department gate as bulk email /
              sequences themselves (see canUseSalesOutreach on the backend). */}
          {(me?.department?.name === "Sales" || currentUser?.role.name === "ADMIN") && (
            <>
              <BulkEmailSenderSection />
              <Card title="Email signature" icon={PenLine}>
                <p className="-mt-1 text-sm text-text-dim">
                  Appended to templates and campaigns that ask for it. Yours follows you, so a
                  shared template signs off as whoever actually sent it.
                </p>
                <EmailSignatureEditor />
              </Card>
            </>
          )}
          <PasswordSection email={me?.email ?? currentUser?.email ?? ""} />
          {me && (
            <p className="text-[11px] text-text-dim">
              Signed in as <span className="font-medium">{getRoleLabel(me)}</span>
              {me.department ? ` · ${me.department.name}` : ""}. Role and department are managed by
              HR/Admin.
            </p>
          )}
        </TabsContent>

        <TabsContent value="my-leaves" className="mt-6">
          <MyLeavesTab userId={currentUser?.id ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── My Leaves Tab ────────────────────────────────────────────────────────────

function MyLeavesTab({ userId }: { userId: string }) {
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const { data: leaves, isLoading } = useLeaveRequests({ userId });
  const updateLeave = useUpdateLeaveRequest();

  const myLeaves = leaves ?? [];

  // Stats
  const pending = myLeaves.filter((l) => l.status === "PENDING").length;
  const approved = myLeaves.filter((l) => l.status === "APPROVED").length;
  const rejected = myLeaves.filter((l) => l.status === "REJECTED").length;

  async function handleCancel(id: string) {
    if (!confirm("Cancel this leave request?")) return;
    await updateLeave.mutateAsync({ id, input: { status: "CANCELLED" } });
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Pending",
            value: pending,
            icon: Clock,
            color: "text-amber-500 bg-amber-500/10",
          },
          { label: "Approved", value: approved, icon: Check, color: "text-success bg-success/10" },
          {
            label: "Rejected",
            value: rejected,
            icon: X,
            color: "text-destructive bg-destructive/10",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-panel border border-border-subtle rounded-xl p-4 flex items-center gap-3"
          >
            <div className={`size-9 rounded-lg grid place-items-center ${color}`}>
              <Icon className="size-4" />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-text-dim">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Request button */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold">Leave History</h2>
        <Button size="sm" onClick={() => setLeaveDialogOpen(true)} className="gap-1.5">
          <Plus className="size-3.5" />
          Request Leave
        </Button>
      </div>

      <LeaveRequestFormDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen} />

      {/* History Table */}
      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewer Note</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-text-dim py-8">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && myLeaves.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-text-dim py-8">
                  No leave requests yet. Click "Request Leave" to get started.
                </TableCell>
              </TableRow>
            )}
            {myLeaves.map((leave) => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

              return (
                <TableRow key={leave.id}>
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
                    {start.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">
                    {end.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">{days}d</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[leave.status]}`}
                    >
                      {LEAVE_STATUS_LABELS[leave.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-text-dim max-w-[200px] truncate">
                    {leave.reviewNote ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {leave.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleCancel(leave.id)}
                        disabled={updateLeave.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Personal Calendar */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">My Leave Calendar</h2>
        <p className="text-xs text-text-dim">Showing your approved leaves on the calendar.</p>
        <LeaveCalendar leaves={myLeaves} showEmployee={false} />
      </div>
    </div>
  );
}

// ─── Existing Profile / Github / Password sections ────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-text-dim" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ProfileSection({ meLoaded, email }: { meLoaded: boolean; email: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: users } = useUsers();
  const me = useMemo(() => users?.find((u) => u.id === currentUser?.id), [users, currentUser]);
  const updateProfile = useUpdateMyProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me) {
      setFirstName(me.firstName);
      setLastName(me.lastName);
      setAvatarUrl(me.avatarUrl ?? "");
    }
  }, [me]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateProfile.mutateAsync({
        firstName,
        lastName,
        avatarUrl: avatarUrl.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save profile");
    }
  }

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <Card title="Profile" icon={UserCircle2}>
      {!meLoaded ? (
        <div className="flex items-center gap-2 text-sm text-text-dim">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback>{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="acct-avatar">Avatar URL</Label>
              <Input
                id="acct-avatar"
                value={avatarUrl}
                onChange={(e) => {
                  setAvatarUrl(e.target.value);
                  setSaved(false);
                }}
                placeholder="https://…/photo.png"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acct-first">First name</Label>
              <Input
                id="acct-first"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-last">Last name</Label>
              <Input
                id="acct-last"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} disabled readOnly />
            <p className="text-[11px] text-text-dim">
              Your email is your login and can't be changed. Contact HR/Admin if it's wrong.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save profile"
              )}
            </Button>
            {saved && !updateProfile.isPending && (
              <span className="text-xs text-success">Saved.</span>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

function GithubSection({ userId, initial }: { userId: string | undefined; initial: string }) {
  const updateGithub = useUpdateGithubUsername();
  const [githubUsername, setGithubUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setGithubUsername(initial);
  }, [initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setSaved(false);
    try {
      await updateGithub.mutateAsync({ id: userId, githubUsername: githubUsername.trim() || null });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save GitHub username");
    }
  }

  return (
    <Card title="GitHub" icon={Github}>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="acct-github">GitHub username</Label>
          <Input
            id="acct-github"
            value={githubUsername}
            onChange={(e) => {
              setGithubUsername(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. octocat"
          />
          <p className="text-[11px] text-text-dim">
            Links your commits &amp; PRs (and repo collaborator invites) to your account.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={updateGithub.isPending}>
            {updateGithub.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
          {saved && !updateGithub.isPending && <span className="text-xs text-success">Saved.</span>}
        </div>
      </form>
    </Card>
  );
}

function PasswordSection({ email }: { email: string }) {
  const requestReset = useRequestPasswordReset();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    try {
      await requestReset.mutateAsync({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send reset link");
    }
  }

  return (
    <Card title="Password" icon={KeyRound}>
      {sent ? (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 max-w-md">
          <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
          <div className="text-sm">
            If an account exists for <span className="font-medium">{email}</span>, a password reset
            link is on its way. The link expires in 1 hour.
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-w-md">
          <p className="text-sm text-text-dim">
            For your security, passwords are changed via an emailed reset link rather than in place.
            We'll send a link to <span className="font-medium text-foreground">{email}</span>.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" onClick={handleReset} disabled={requestReset.isPending || !email}>
            {requestReset.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Email me a reset link"
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
