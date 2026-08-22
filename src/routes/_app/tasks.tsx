import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Bug as BugIcon,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  LayoutDashboard,
  ListTodo,
  Plus,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ZohoTaskPagePanel } from "@/components/zoho-task-page-panel";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { useTasks } from "@/hooks/use-tasks";
import { useBugs } from "@/hooks/use-bugs";
import { useProjects } from "@/hooks/use-projects";
import { useAuthStore } from "@/stores/auth-store";
import {
  BUG_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Bug,
  type ProjectTaskDetail,
  type TaskStatus,
} from "@/lib/api/types";

export const Route = createFileRoute("/_app/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: tasks = [], isLoading } = useTasks();
  const { data: bugs = [] } = useBugs();
  const { data: projects = [] } = useProjects();

  const [activeViewTab, setActiveViewTab] = useState<
    "all" | "manager_dashboard" | "employee_dashboard" | "tester_dashboard"
  >("all");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const isManagerOrAdmin =
    currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";

  // Filter tasks
  const filteredTasks = (tasks as unknown as ProjectTaskDetail[]).filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.project?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Metrics for Dashboards
  const totalTasks = tasks.length;
  const activeProjectsCount = projects.filter((p) => p.status === "ACTIVE").length;
  const pendingTestingCount = tasks.filter((t) => t.status === "READY_FOR_TESTING").length;
  const completedTasksCount = tasks.filter((t) => t.status === "DONE").length;

  const openBugs = bugs.filter((b) => b.status !== "CLOSED");
  const criticalBugs = bugs.filter(
    (b) => b.status !== "CLOSED" && (b.severity === "CRITICAL" || b.severity === "HIGH")
  );

  const myTasks = (tasks as unknown as ProjectTaskDetail[]).filter(
    (t) =>
      t.assigneeId === currentUser?.id ||
      t.assignees?.some((a) => a.userId === currentUser?.id)
  );

  const myBugs = bugs.filter((b) => b.assigneeId === currentUser?.id && b.status !== "CLOSED");
  const testingQueue = (tasks as unknown as ProjectTaskDetail[]).filter(
    (t) => t.testerId === currentUser?.id || t.status === "READY_FOR_TESTING"
  );

  if (selectedTaskId) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background text-text">
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-card">
          <ZohoTaskPagePanel
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
          />
        </div>
        <TaskFormDialog
          open={showCreateTaskDialog}
          onOpenChange={setShowCreateTaskDialog}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background text-text">
      {/* ── Main Task Workspace ── */}
      <div className="flex flex-col flex-1 overflow-y-auto w-full">
        {/* Workspace Header */}
        <div className="border-b border-border bg-card/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-primary font-mono">
                  Zoho Projects Engine
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text">
                Tasks & Bug Tracking Workspace
              </h1>
            </div>

            <Button
              onClick={() => setShowCreateTaskDialog(true)}
              className="gap-2 font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>

          {/* Dashboards & View Selector Tabs */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
            <button
              onClick={() => setActiveViewTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeViewTab === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card hover:bg-card-hover text-text-dim"
              }`}
            >
              <Layers className="inline h-3.5 w-3.5 mr-1" />
              All Tasks & Projects
            </button>

            {isManagerOrAdmin && (
              <button
                onClick={() => setActiveViewTab("manager_dashboard")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeViewTab === "manager_dashboard"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card hover:bg-card-hover text-text-dim"
                }`}
              >
                <LayoutDashboard className="inline h-3.5 w-3.5 mr-1" />
                Manager Dashboard
              </button>
            )}

            <button
              onClick={() => setActiveViewTab("employee_dashboard")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeViewTab === "employee_dashboard"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card hover:bg-card-hover text-text-dim"
              }`}
            >
              <User className="inline h-3.5 w-3.5 mr-1" />
              Developer Workload ({myTasks.length})
            </button>

            <button
              onClick={() => setActiveViewTab("tester_dashboard")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeViewTab === "tester_dashboard"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-card hover:bg-card-hover text-text-dim"
              }`}
            >
              <ShieldCheck className="inline h-3.5 w-3.5 mr-1" />
              Testing Queue ({testingQueue.length})
            </button>
          </div>
        </div>

        {/* Dynamic Views Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* MANAGER DASHBOARD VIEW */}
          {activeViewTab === "manager_dashboard" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-text">Manager Executive Summary</h2>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs text-text-dim font-medium">Active Projects</span>
                  <p className="text-2xl font-bold text-text font-mono mt-1">{activeProjectsCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs text-text-dim font-medium">Tasks Under Testing</span>
                  <p className="text-2xl font-bold text-purple-400 font-mono mt-1">{pendingTestingCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs text-text-dim font-medium">Open Bugs</span>
                  <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{openBugs.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-xs text-text-dim font-medium">Critical / High Severity</span>
                  <p className="text-2xl font-bold text-destructive font-mono mt-1">{criticalBugs.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* DEVELOPER DASHBOARD VIEW */}
          {activeViewTab === "employee_dashboard" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-text">My Workload & Assigned Bugs</h2>
              {myBugs.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    {myBugs.length} Bug(s) Assigned to You to Fix
                  </div>
                  <div className="divide-y divide-amber-500/20">
                    {myBugs.map((b) => (
                      <div key={b.id} className="py-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-text">Bug #{b.bugNumber}: {b.title}</span>
                        <Badge variant="outline" className="text-[10px]">{BUG_STATUS_LABELS[b.status]}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TESTER DASHBOARD VIEW */}
          {activeViewTab === "tester_dashboard" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-text">Quality Assurance & Testing Queue</h2>
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-purple-300 text-xs">
                <ShieldCheck className="h-5 w-5 text-purple-400 inline mr-2" />
                Select any task below to perform Tester Validation, check Daily Updates, Time Logs, and Bug resolutions before final approval.
              </div>
            </div>
          )}

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Input
              placeholder="Search tasks or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs text-xs"
            />

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-text-dim" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-text"
              >
                <option value="ALL">All Statuses</option>
                {TASK_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {TASK_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tasks Master Table / List */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-text-dim uppercase font-semibold">
                <tr>
                  <th className="p-3">Task #</th>
                  <th className="p-3">Title & Project</th>
                  <th className="p-3">Assignees</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 font-right">Bugs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((t) => {
                    const isSelected = t.id === selectedTaskId;
                    const taskBugsCount =
                      (t.bugs?.length ?? 0) +
                      (t.subtasks ?? []).reduce((acc, st) => acc + (st.bugs?.length ?? 0), 0);
                    const openBugs =
                      (t.bugs?.filter((b) => b.status !== "CLOSED").length ?? 0) +
                      (t.subtasks ?? []).reduce(
                        (acc, st) =>
                          acc + (st.bugs?.filter((b) => b.status !== "CLOSED").length ?? 0),
                        0
                      );

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/15 font-medium border-l-4 border-l-primary"
                            : "hover:bg-card-hover/40"
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-primary">
                          #{t.taskNumber}
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-text block">{t.title}</span>
                            <span className="text-[11px] text-text-dim">
                              {t.project?.name ?? "No Project"}
                              {t.subtasks && t.subtasks.length > 0 && (
                                <span className="ml-2 text-purple-400 font-semibold">
                                  ({t.subtasks.length} subtasks)
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {t.assignees && t.assignees.length > 0 ? (
                              t.assignees.map((a) => (
                                <Avatar key={a.id} className="h-5 w-5">
                                  <AvatarFallback className="text-[9px]">
                                    {a.user.firstName[0]}
                                  </AvatarFallback>
                                </Avatar>
                              ))
                            ) : t.assignee ? (
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[9px]">
                                  {t.assignee.firstName[0]}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="italic text-text-dim text-[11px]">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {TASK_STATUS_LABELS[t.status]}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {taskBugsCount > 0 ? (
                            <span
                              className={`font-mono font-bold text-[11px] ${
                                openBugs > 0 ? "text-amber-400" : "text-emerald-400"
                              }`}
                            >
                              {openBugs} Open / {taskBugsCount}
                            </span>
                          ) : (
                            <span className="text-text-dim text-[11px]">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-text-dim italic">
                      No tasks match criteria. Click &quot;New Task&quot; to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>



      {/* Create Task Form Dialog */}
      <TaskFormDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
      />
    </div>
  );
}
