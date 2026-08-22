import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Users2,
  CalendarDays,
  ClipboardList,
  Check,
  X,
  Clock,
  Loader2,
  MessageSquare,
  LogIn,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmployeeFormDialog } from "@/components/employee-form-dialog";
import { DepartmentFormDialog } from "@/components/department-form-dialog";
import { LeaveRequestFormDialog } from "@/components/leave-request-form-dialog";
import { LeaveCalendar } from "@/components/leave-calendar";
import { useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import { useLeaveRequests, useUpdateLeaveRequest } from "@/hooks/use-leave-requests";
import { useLoginEvents, useLastLogins } from "@/hooks/use-login-events";
import { useAuthStore } from "@/stores/auth-store";
import { getRoleLabel } from "@/lib/role-label";
import {
  ROLE_LABELS,
  ROLE_NAMES,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPES,
  type Department,
  type RoleName,
  type UserSummary,
  type LeaveStatus,
} from "@/lib/api/types";

// "3 hours ago" style relative time, with an absolute fallback for older dates.
function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "Just now";
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Condense a raw user-agent into a short "Browser · OS" label.
function formatDevice(ua: string | null): string {
  if (!ua) return "—";
  const browser =
    /edg/i.test(ua) ? "Edge"
    : /chrome|crios/i.test(ua) ? "Chrome"
    : /firefox|fxios/i.test(ua) ? "Firefox"
    : /safari/i.test(ua) ? "Safari"
    : "Browser";
  const os =
    /windows/i.test(ua) ? "Windows"
    : /mac os|macintosh/i.test(ua) ? "macOS"
    : /android/i.test(ua) ? "Android"
    : /iphone|ipad|ios/i.test(ua) ? "iOS"
    : /linux/i.test(ua) ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
}

export const Route = createFileRoute("/_app/hr")({
  component: HrPage,
});

const ALL = "__all__";

const ROLE_TONE: Record<RoleName, string> = {
  ADMIN: "text-violet",
  MANAGER: "text-info",
  EMPLOYEE: "text-text-dim",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  APPROVED: "bg-success/15 text-success border-success/20",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/20",
  CANCELLED: "bg-muted text-text-dim border-border-subtle",
};

function HrPage() {
  const canManage = useAuthStore(
    (s) => s.user?.role.name === "ADMIN" || s.user?.department?.name === "HR",
  );
  const isAdmin = useAuthStore((s) => s.user?.role.name === "ADMIN");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
            <Users2 className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">HR / Team</h1>
            <p className="text-sm text-text-dim mt-1">
              Departments, reporting lines, employee directory, and leave management.
            </p>
          </div>
        </div>
        <Button onClick={() => setLeaveDialogOpen(true)} className="gap-2 shrink-0">
          <CalendarDays className="size-4" />
          Request Leave
        </Button>
      </div>

      <LeaveRequestFormDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen} />

      <Tabs defaultValue="employees">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="employees">
            <Users2 className="size-3.5 mr-1.5" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          {(canManage || isAdmin) && (
            <TabsTrigger value="leave-requests">
              <ClipboardList className="size-3.5 mr-1.5" />
              Leave Requests
            </TabsTrigger>
          )}
          <TabsTrigger value="leave-calendar">
            <CalendarDays className="size-3.5 mr-1.5" />
            Leave Calendar
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="activity">
              <Clock className="size-3.5 mr-1.5" />
              Login Activity
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <EmployeesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <DepartmentsTab canManage={canManage} />
        </TabsContent>
        {(canManage || isAdmin) && (
          <TabsContent value="leave-requests" className="mt-4">
            <LeaveRequestsTab />
          </TabsContent>
        )}
        <TabsContent value="leave-calendar" className="mt-4">
          <LeaveCalendarTab isHrOrAdmin={!!(canManage || isAdmin)} />
        </TabsContent>
        {canManage && (
          <TabsContent value="activity" className="mt-4">
            <ActivityTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── Leave Requests Tab (HR/Admin) ────────────────────────────────────────────

function LeaveRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [userFilter, setUserFilter] = useState<string>(ALL);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>(ALL);

  const { data: leaves, isLoading } = useLeaveRequests(
    statusFilter !== ALL ? { status: statusFilter as LeaveStatus } : undefined,
  );
  const { data: users } = useUsers();
  const updateLeave = useUpdateLeaveRequest();

  const filtered = useMemo(() => {
    return (leaves ?? []).filter((l) => {
      if (userFilter !== ALL && l.userId !== userFilter) return false;
      if (leaveTypeFilter !== ALL && l.type !== leaveTypeFilter) return false;
      return true;
    });
  }, [leaves, userFilter, leaveTypeFilter]);

  async function handleAction(id: string, action: "APPROVED" | "REJECTED", note?: string) {
    await updateLeave.mutateAsync({ id, input: { status: action, reviewNote: note } });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {(users ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Leave type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {LEAVE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {LEAVE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-text-dim py-8">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-text-dim py-8">
                  No leave requests match these filters.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((leave) => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

              return (
                <TableRow key={leave.id}>
                  {/* Employee */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">
                          {leave.user.firstName[0]}{leave.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {leave.user.firstName} {leave.user.lastName}
                      </span>
                    </div>
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: LEAVE_TYPE_COLORS[leave.type] }}
                      />
                      {LEAVE_TYPE_LABELS[leave.type]}
                    </span>
                  </TableCell>

                  {/* Dates */}
                  <TableCell className="text-sm text-text-dim">
                    {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">
                    {end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">{days}d</TableCell>

                  {/* Status */}
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[leave.status]}`}>
                      {leave.status === "PENDING" && <Clock className="size-3" />}
                      {leave.status === "APPROVED" && <Check className="size-3" />}
                      {leave.status === "REJECTED" && <X className="size-3" />}
                      {LEAVE_STATUS_LABELS[leave.status]}
                    </span>
                  </TableCell>

                  {/* Reason */}
                  <TableCell className="text-sm text-text-dim max-w-[180px] truncate">
                    {leave.reason ?? "—"}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    {leave.status === "PENDING" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionButton
                          leaveId={leave.id}
                          action="APPROVED"
                          onConfirm={handleAction}
                          isPending={updateLeave.isPending}
                        />
                        <ActionButton
                          leaveId={leave.id}
                          action="REJECTED"
                          onConfirm={handleAction}
                          isPending={updateLeave.isPending}
                        />
                      </div>
                    ) : (
                      <span className="text-[11px] text-text-dim">
                        {leave.reviewedBy
                          ? `By ${leave.reviewedBy.firstName} ${leave.reviewedBy.lastName}`
                          : "—"}
                      </span>
                    )}
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

function ActionButton({
  leaveId,
  action,
  onConfirm,
  isPending,
}: {
  leaveId: string;
  action: "APPROVED" | "REJECTED";
  onConfirm: (id: string, action: "APPROVED" | "REJECTED", note?: string) => Promise<void>;
  isPending: boolean;
}) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const isApprove = action === "APPROVED";

  async function handleConfirm() {
    await onConfirm(leaveId, action, note.trim() || undefined);
    setOpen(false);
    setNote("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={isApprove ? "default" : "outline"}
          className={`h-7 px-2.5 text-xs gap-1 ${
            !isApprove ? "text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" : ""
          }`}
          disabled={isPending}
        >
          {isApprove ? <Check className="size-3" /> : <X className="size-3" />}
          {isApprove ? "Approve" : "Reject"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="end">
        <p className="text-sm font-medium">
          {isApprove ? "Approve this leave?" : "Reject this leave?"}
        </p>
        <div className="space-y-1.5">
          <label className="text-xs text-text-dim">
            Note <span className="opacity-60">(optional)</span>
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isApprove ? "Any notes for the employee…" : "Reason for rejection…"}
            rows={2}
            className="text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="size-3 animate-spin" /> : "Confirm"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Leave Calendar Tab ───────────────────────────────────────────────────────

function LeaveCalendarTab({ isHrOrAdmin }: { isHrOrAdmin: boolean }) {
  const { data: leaves, isLoading } = useLeaveRequests();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-dim py-8">
        <Loader2 className="size-4 animate-spin" />
        Loading calendar…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isHrOrAdmin && (
        <p className="text-sm text-text-dim">
          Showing all approved leaves across your organisation.
        </p>
      )}
      <LeaveCalendar leaves={leaves ?? []} showEmployee={isHrOrAdmin} />
    </div>
  );
}

// ─── Existing Employees Tab ───────────────────────────────────────────────────

function EmployeesTab({ canManage }: { canManage: boolean }) {
  const [departmentId, setDepartmentId] = useState<string>(ALL);
  const [role, setRole] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | undefined>(undefined);

  const { data: users, isLoading } = useUsers();
  const { data: departments } = useDepartments();
  const { data: lastLogins } = useLastLogins({ enabled: canManage });

  const lastLoginByUser = useMemo(() => {
    const m = new Map<string, string | null>();
    (lastLogins ?? []).forEach((l) => m.set(l.userId, l.lastLoginAt));
    return m;
  }, [lastLogins]);

  const colCount = canManage ? 7 : 6;

  const filtered = useMemo(() => {
    return (users ?? []).filter((u) => {
      if (departmentId !== ALL && u.department?.id !== departmentId) return false;
      if (role !== ALL && u.role.name !== role) return false;
      if (status === "active" && !u.isActive) return false;
      if (status === "inactive" && u.isActive) return false;
      return true;
    });
  }, [users, departmentId, role, status]);

  function openCreate() {
    setEditingUser(undefined);
    setDialogOpen(true);
  }

  function openEdit(user: UserSummary) {
    setEditingUser(user);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All roles</SelectItem>
              {ROLE_NAMES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add Employee
          </Button>
        )}
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Reports To</TableHead>
              {canManage && <TableHead>Last login</TableHead>}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-text-dim py-8">
                  No employees match these filters.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((user) => (
              <TableRow
                key={user.id}
                className={canManage ? "cursor-pointer" : ""}
                onClick={() => canManage && openEdit(user)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-text-dim">{user.email}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${ROLE_TONE[user.role.name]}`}>
                    {getRoleLabel(user)}
                  </span>
                </TableCell>
                <TableCell className="text-text-dim">{user.department?.name ?? "Unassigned"}</TableCell>
                <TableCell className="text-text-dim">
                  {user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : "—"}
                </TableCell>
                {canManage && (
                  <TableCell className="text-text-dim">
                    {formatRelative(lastLoginByUser.get(user.id) ?? null)}
                  </TableCell>
                )}
                <TableCell>
                  <span
                    className={`text-xs px-2 py-0.5 rounded bg-panel-elevated ${user.isActive ? "text-success" : "text-text-dim"}`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <EmployeeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editingUser} />
      )}
    </div>
  );
}

// ─── Existing Departments Tab ─────────────────────────────────────────────────

function DepartmentsTab({ canManage }: { canManage: boolean }) {
  const { data: departments, isLoading } = useDepartments();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | undefined>(undefined);

  function openCreate() {
    setEditingDepartment(undefined);
    setDialogOpen(true);
  }

  function openEdit(department: Department) {
    setEditingDepartment(department);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add Department
          </Button>
        )}
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Head</TableHead>
              <TableHead>Employees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && departments?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-text-dim py-8">
                  No departments yet.
                </TableCell>
              </TableRow>
            )}
            {departments?.map((dept) => (
              <TableRow
                key={dept.id}
                className={canManage ? "cursor-pointer" : ""}
                onClick={() => canManage && openEdit(dept)}
              >
                <TableCell className="font-medium">{dept.name}</TableCell>
                <TableCell className="text-text-dim">{dept.description ?? "—"}</TableCell>
                <TableCell className="text-text-dim">
                  {dept.head ? `${dept.head.firstName} ${dept.head.lastName}` : "—"}
                </TableCell>
                <TableCell className="text-text-dim">{dept._count.employees}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <DepartmentFormDialog open={dialogOpen} onOpenChange={setDialogOpen} department={editingDepartment} />
      )}
    </div>
  );
}

// ─── Login Activity Tab (HR/Admin) ────────────────────────────────────────────

function ActivityTab() {
  const [userId, setUserId] = useState<string>(ALL);
  const { data: users } = useUsers();
  const { data: events, isLoading } = useLoginEvents({
    userId: userId === ALL ? undefined : userId,
    limit: 300,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-dim">
          Sign-in and sign-out history across the company. Newest first.
        </p>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {(users ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>IP address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (events ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  No login activity recorded yet.
                </TableCell>
              </TableRow>
            )}
            {(events ?? []).map((e) => {
              const isLogin = e.type === "LOGIN";
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">
                          {e.user.firstName[0]}
                          {e.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {e.user.firstName} {e.user.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-panel-elevated ${
                        isLogin ? "text-success" : "text-text-dim"
                      }`}
                    >
                      {isLogin ? <LogIn className="size-3" /> : <LogOut className="size-3" />}
                      {isLogin ? "Signed in" : "Signed out"}
                    </span>
                  </TableCell>
                  <TableCell className="text-text-dim" title={formatDateTime(e.createdAt)}>
                    {formatRelative(e.createdAt)}
                  </TableCell>
                  <TableCell className="text-text-dim">{formatDevice(e.userAgent)}</TableCell>
                  <TableCell className="text-text-dim font-mono text-xs">{e.ipAddress ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
