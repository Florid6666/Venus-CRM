import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bug as BugIcon,
  CheckCircle2,
  Clock,
  FileText,
  History,
  ListTodo,
  Plus,
  Send,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/auth-store";
import { useTask, useUpdateTask, useCreateTask } from "@/hooks/use-tasks";
import { useBugs, useCreateBug, useUpdateBug, useAddBugComment } from "@/hooks/use-bugs";
import { useCreateTaskUpdate } from "@/hooks/use-task-updates";
import { useCreateTimeLog } from "@/hooks/use-time-logs";
import { useUsers } from "@/hooks/use-users";
import {
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  BUG_SEVERITY_COLORS,
  BUG_STATUS_LABELS,
  BUG_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type BugPriority,
  type BugSeverity,
  type BugStatus,
  type ProjectTaskDetail,
  type TaskStatus,
} from "@/lib/api/types";
import { toast } from "sonner";

interface ZohoTaskPagePanelProps {
  taskId: string;
  onClose?: () => void;
}

export function ZohoTaskPagePanel({ taskId, onClose }: ZohoTaskPagePanelProps) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: task, isLoading, error } = useTask(taskId);
  const { data: bugsList = [] } = useBugs({ taskId });
  const { data: allUsers = [] } = useUsers();

  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const createBug = useCreateBug();
  const updateBug = useUpdateBug();
  const addBugComment = useAddBugComment();
  const createTaskUpdate = useCreateTaskUpdate();
  const createTimeLog = useCreateTimeLog();

  const [activeTab, setActiveTab] = useState<
    "overview" | "updates" | "timelogs" | "bugs" | "testing" | "activity"
  >("overview");

  // Form states
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState("");

  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [workCompleted, setWorkCompleted] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [blockers, setBlockers] = useState("");
  const [notes, setNotes] = useState("");

  const [showTimeLogForm, setShowTimeLogForm] = useState(false);
  const [startTime, setStartTime] = useState("10:00 AM");
  const [endTime, setEndTime] = useState("01:00 PM");
  const [logHours, setLogHours] = useState("3.0");
  const [timeLogSummary, setTimeLogSummary] = useState("");

  const [showBugForm, setShowBugForm] = useState(false);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSeverity, setBugSeverity] = useState<BugSeverity>("MEDIUM");
  const [bugPriority, setBugPriority] = useState<BugPriority>("MEDIUM");
  const [bugAssigneeId, setBugAssigneeId] = useState("");
  const [bugSubtaskId, setBugSubtaskId] = useState("");

  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [bugCommentText, setBugCommentText] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12 text-text-dim">
        Loading Task Panel...
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-8 text-destructive">
        Failed to load task details.
      </div>
    );
  }

  const detailedTask = task as unknown as ProjectTaskDetail;
  const isMultipleAssignees =
    (detailedTask.assignees && detailedTask.assignees.length > 1) ||
    (detailedTask.assigneeId && detailedTask.assignees && detailedTask.assignees.length > 1);

  const isTester = currentUser?.id === detailedTask.testerId;
  const isManagerOrAdmin =
    currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";

  // Calculate totals
  const totalLoggedMinutes =
    (detailedTask.timeLogs ?? []).reduce((acc, l) => acc + l.minutes, 0) +
    (detailedTask.subtasks ?? []).reduce(
      (acc, st) => acc + (st.timeLogs ?? []).reduce((stAcc, l) => stAcc + l.minutes, 0),
      0
    );

  const allTaskBugs = [
    ...(detailedTask.bugs ?? []),
    ...(detailedTask.subtasks ?? []).flatMap((st) => st.bugs ?? []),
  ];

  const openBugsCount = allTaskBugs.filter((b) => b.status !== "CLOSED").length;
  const closedBugsCount = allTaskBugs.filter((b) => b.status === "CLOSED").length;

  // Validation Checks for Tester Completion
  const hasDailyUpdates =
    (detailedTask.updates?.length ?? 0) > 0 ||
    detailedTask.subtasks?.some((st) => (st.updates?.length ?? 0) > 0);
  const hasTimeLogs = totalLoggedMinutes > 0;
  const allBugsClosed = openBugsCount === 0;
  const allSubtasksDone =
    !detailedTask.subtasks ||
    detailedTask.subtasks.length === 0 ||
    detailedTask.subtasks.every((st) => st.status === "DONE");
  const isReadyForTesting = detailedTask.status === "READY_FOR_TESTING";

  const canCompleteTask =
    hasDailyUpdates && hasTimeLogs && allBugsClosed && allSubtasksDone && (isReadyForTesting || detailedTask.status === "DONE");

  // Handlers
  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id: taskId, input: { status: newStatus } });
      toast.success(`Task status updated to ${TASK_STATUS_LABELS[newStatus]}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update task status");
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: subtaskTitle.trim(),
        parentId: taskId,
        projectId: detailedTask.projectId || undefined,
        assigneeId: subtaskAssigneeId || undefined,
        testerId: detailedTask.testerId || undefined,
      });
      setSubtaskTitle("");
      setSubtaskAssigneeId("");
      setShowSubtaskForm(false);
      toast.success("Subtask created successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create subtask");
    }
  };

  const handleCreateDailyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCompleted.trim()) {
      toast.error("Work completed field is required.");
      return;
    }
    const fullContent = [
      `Completed: ${workCompleted}`,
      nextPlan ? `Next Plan: ${nextPlan}` : "",
      blockers ? `Blockers: ${blockers}` : "",
      notes ? `Notes: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await createTaskUpdate.mutateAsync({
        taskId,
        content: fullContent,
      });
      setWorkCompleted("");
      setNextPlan("");
      setBlockers("");
      setNotes("");
      setShowUpdateForm(false);
      toast.success("Daily work update recorded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to add daily update");
    }
  };

  const handleCreateTimeLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = Math.round(parseFloat(logHours) * 60);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error("Please enter valid logged hours.");
      return;
    }
    try {
      await createTimeLog.mutateAsync({
        taskId,
        minutes,
        date: new Date().toISOString(),
        note: `${startTime} - ${endTime}: ${timeLogSummary}`,
      });
      setTimeLogSummary("");
      setShowTimeLogForm(false);
      toast.success("Time log submitted!");
    } catch (err: any) {
      toast.error(err.message || "Failed to record time log");
    }
  };

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim()) return;
    try {
      await createBug.mutateAsync({
        title: bugTitle.trim(),
        description: bugDescription.trim() || undefined,
        taskId,
        subtaskId: bugSubtaskId || undefined,
        severity: bugSeverity,
        priority: bugPriority,
        assigneeId: bugAssigneeId || undefined,
      });
      setBugTitle("");
      setBugDescription("");
      setShowBugForm(false);
      toast.success("Bug logged successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create bug");
    }
  };

  const handleUpdateBugStatus = async (bugId: string, status: BugStatus) => {
    try {
      await updateBug.mutateAsync({ id: bugId, input: { status } });
      toast.success(`Bug status updated to ${BUG_STATUS_LABELS[status]}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update bug status");
    }
  };

  const handleAddBugComment = async (bugId: string) => {
    if (!bugCommentText.trim()) return;
    try {
      await addBugComment.mutateAsync({ id: bugId, content: bugCommentText.trim() });
      setBugCommentText("");
      toast.success("Comment added to bug.");
    } catch (err: any) {
      toast.error(err.message || "Failed to add comment");
    }
  };

  const selectedBug = allTaskBugs.find((b) => b.id === selectedBugId);

  return (
    <div className="flex h-full flex-col bg-card/60 text-text font-sans">
      {/* ── Top Header Panel ── */}
      <div className="border-b border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs text-primary">
                Task #{detailedTask.taskNumber}
              </Badge>
              {detailedTask.project && (
                <span className="text-xs font-medium text-text-dim">
                  Project: <strong className="text-text">{detailedTask.project.name}</strong>
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text">
              {detailedTask.title}
            </h1>
          </div>

          {/* Workflow Status Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              {(
                [
                  "TODO",
                  "IN_PROGRESS",
                  "READY_FOR_TESTING",
                  "CHANGES_REQUIRED",
                  "DONE",
                ] as TaskStatus[]
              ).map((st) => {
                const isActive = detailedTask.status === st;
                return (
                  <button
                    key={st}
                    onClick={() => {
                      if (st === "DONE" && !isTester && !isManagerOrAdmin) {
                        toast.error(
                          "Developers cannot directly mark tasks Completed. Please move to Ready for Testing for Tester validation."
                        );
                        return;
                      }
                      handleStatusChange(st);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-text-dim hover:bg-card hover:text-text"
                    }`}
                  >
                    {TASK_STATUS_LABELS[st]}
                  </button>
                );
              })}
            </div>

            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                title="Close Panel"
                className="h-8 w-8 rounded-full border border-border bg-background/80 text-text-dim hover:bg-destructive/20 hover:text-destructive hover:border-destructive/30 transition-all shrink-0"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close Panel</span>
              </Button>
            )}
          </div>
        </div>

        {/* Assignees & Tester Row */}
        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-border/50 pt-4 text-xs">
          {/* Assigned Developers */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium text-text-dim">Assigned Developers:</span>
            <div className="flex items-center gap-1.5">
              {detailedTask.assignees && detailedTask.assignees.length > 0 ? (
                detailedTask.assignees.map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 border border-border">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[9px]">
                        {a.user.firstName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-text">{a.user.firstName} {a.user.lastName}</span>
                  </div>
                ))
              ) : detailedTask.assignee ? (
                <div className="flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 border border-border">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="text-[9px]">
                      {detailedTask.assignee.firstName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-text">
                    {detailedTask.assignee.firstName} {detailedTask.assignee.lastName}
                  </span>
                </div>
              ) : (
                <span className="italic text-text-dim">Unassigned</span>
              )}
            </div>
          </div>

          {/* Designated Tester */}
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            <span className="font-medium text-text-dim">Designated Tester:</span>
            {detailedTask.tester ? (
              <div className="flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 text-purple-300">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[9px]">
                    {detailedTask.tester.firstName[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold">
                  {detailedTask.tester.firstName} {detailedTask.tester.lastName}
                </span>
              </div>
            ) : (
              <select
                onChange={(e) =>
                  updateTask.mutate({
                    id: taskId,
                    input: { testerId: e.target.value || null },
                  })
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-text"
              >
                <option value="">Assign Tester...</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role.name})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Logged Hours Gauge */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span className="font-medium text-text-dim">Logged Time:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {(totalLoggedMinutes / 60).toFixed(1)} hrs
            </span>
          </div>

          {/* Bugs Counter */}
          <div className="flex items-center gap-2">
            <BugIcon className="h-4 w-4 text-amber-400" />
            <span className="font-medium text-text-dim">Bugs:</span>
            <span className={`font-bold font-mono ${openBugsCount > 0 ? "text-destructive" : "text-emerald-400"}`}>
              {openBugsCount} Open / {allTaskBugs.length} Total
            </span>
          </div>
        </div>
      </div>

      {/* ── Page Panels Tab Navigation ── */}
      <div className="flex border-b border-border bg-card/40 px-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-text-dim hover:text-text"
          }`}
        >
          <ListTodo className="h-4 w-4" />
          Overview & Subtasks
          {detailedTask.subtasks && detailedTask.subtasks.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {detailedTask.subtasks.length}
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("updates")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === "updates"
              ? "border-primary text-primary"
              : "border-transparent text-text-dim hover:text-text"
          }`}
        >
          <FileText className="h-4 w-4" />
          Daily Progress Updates
          {(detailedTask.updates?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {detailedTask.updates?.length}
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("timelogs")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === "timelogs"
              ? "border-primary text-primary"
              : "border-transparent text-text-dim hover:text-text"
          }`}
        >
          <Clock className="h-4 w-4" />
          Time Logs
          {(detailedTask.timeLogs?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {detailedTask.timeLogs?.length}
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("bugs")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === "bugs"
              ? "border-primary text-primary"
              : "border-transparent text-text-dim hover:text-text"
          }`}
        >
          <BugIcon className="h-4 w-4" />
          Bugs Panel
          {allTaskBugs.length > 0 && (
            <Badge
              variant={openBugsCount > 0 ? "destructive" : "secondary"}
              className="ml-1 text-[10px]"
            >
              {openBugsCount > 0 ? `${openBugsCount} Open` : "Clean"}
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("testing")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === "testing"
              ? "border-primary text-primary"
              : "border-transparent text-text-dim hover:text-text"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Testing & Validation
          {canCompleteTask && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === "activity"
              ? "border-primary text-primary"
              : "border-transparent text-text-dim hover:text-text"
          }`}
        >
          <History className="h-4 w-4" />
          Audit History
        </button>
      </div>

      {/* ── Main Tabbed Panel Body ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* PANEL 1: OVERVIEW & SUBTASKS */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Description */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-dim">
                Task Description
              </h3>
              <p className="mt-2 text-sm text-text whitespace-pre-wrap leading-relaxed">
                {detailedTask.description || "No description provided for this task."}
              </p>
            </div>

            {/* Rule 2 Indicator Banner for Multiple Assignees */}
            {isMultipleAssignees && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="text-xs space-y-1">
                  <strong className="font-bold text-amber-300">
                    Rule 2 Active: Multiple Employees Assigned
                  </strong>
                  <p>
                    This task has 2 or more assigned contributors. Per collaboration rules, please structure this task into distinct subtasks assigned to individual developers below.
                  </p>
                </div>
              </div>
            )}

            {/* Subtasks Section */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text">Subtasks Breakdown</h3>
                  <p className="text-xs text-text-dim">
                    Assign specific sub-modules to developers
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowSubtaskForm(!showSubtaskForm)}
                  className="gap-1 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Subtask
                </Button>
              </div>

              {/* Subtask Form */}
              {showSubtaskForm && (
                <form
                  onSubmit={handleCreateSubtask}
                  className="space-y-3 rounded-lg border border-primary/30 bg-background/80 p-4"
                >
                  <Input
                    placeholder="Subtask Title (e.g. User CRUD APIs)"
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    className="text-xs"
                    required
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={subtaskAssigneeId}
                      onChange={(e) => setSubtaskAssigneeId(e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text flex-1"
                    >
                      <option value="">Select Assignee...</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.role.name})
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" className="text-xs">
                      Save Subtask
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSubtaskForm(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {/* Subtasks List */}
              {detailedTask.subtasks && detailedTask.subtasks.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {detailedTask.subtasks.map((st) => (
                    <div
                      key={st.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-3 hover:bg-card-hover/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-text">
                            {st.title}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {TASK_STATUS_LABELS[st.status]}
                          </Badge>
                        </div>
                        {st.assignee && (
                          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
                            <span>Assigned to:</span>
                            <span className="font-medium text-text">
                              {st.assignee.firstName} {st.assignee.lastName}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={st.status}
                          onChange={(e) =>
                            updateTask.mutate({
                              id: st.id,
                              input: { status: e.target.value as TaskStatus },
                            })
                          }
                          className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-text"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs italic text-text-dim">
                  No subtasks created yet for this task.
                </p>
              )}
            </div>
          </div>
        )}

        {/* PANEL 2: DAILY PROGRESS UPDATES */}
        {activeTab === "updates" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text">Daily Work Tracking</h3>
                <p className="text-xs text-text-dim">
                  Submit date-stamped progress reports, next plans, and blockers
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowUpdateForm(!showUpdateForm)}
                className="gap-1 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Submit Daily Update
              </Button>
            </div>

            {/* Daily Update Form */}
            {showUpdateForm && (
              <form
                onSubmit={handleCreateDailyUpdate}
                className="space-y-4 rounded-xl border border-primary/30 bg-card p-5 shadow-sm"
              >
                <h4 className="text-sm font-bold text-primary">Daily Progress Entry</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">
                      Work Completed Today *
                    </label>
                    <Textarea
                      placeholder="What did you build or finish today?"
                      value={workCompleted}
                      onChange={(e) => setWorkCompleted(e.target.value)}
                      className="text-xs h-20"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">
                      Next Planned Work
                    </label>
                    <Textarea
                      placeholder="What will you work on tomorrow?"
                      value={nextPlan}
                      onChange={(e) => setNextPlan(e.target.value)}
                      className="text-xs h-20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">Blockers</label>
                    <Input
                      placeholder="Any impediments holding you back?"
                      value={blockers}
                      onChange={(e) => setBlockers(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">Notes</label>
                    <Input
                      placeholder="Additional comments or PR links"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUpdateForm(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="text-xs">
                    Record Update
                  </Button>
                </div>
              </form>
            )}

            {/* Updates History */}
            {detailedTask.updates && detailedTask.updates.length > 0 ? (
              <div className="space-y-4">
                {detailedTask.updates.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {u.user.firstName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-xs text-text">
                          {u.user.firstName} {u.user.lastName}
                        </span>
                      </div>
                      <span className="text-[11px] text-text-dim font-mono">
                        {new Date(u.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-text whitespace-pre-wrap">{u.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs italic text-text-dim">
                No daily updates logged yet. Daily updates are required before completing this task.
              </p>
            )}
          </div>
        )}

        {/* PANEL 3: TIME LOGS */}
        {activeTab === "timelogs" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text">Time Logging System</h3>
                <p className="text-xs text-text-dim">
                  Log working hours spent on tasks & subtasks
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowTimeLogForm(!showTimeLogForm)}
                className="gap-1 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Hours
              </Button>
            </div>

            {/* Time Log Form */}
            {showTimeLogForm && (
              <form
                onSubmit={handleCreateTimeLog}
                className="space-y-4 rounded-xl border border-emerald-500/30 bg-card p-5 shadow-sm"
              >
                <h4 className="text-sm font-bold text-emerald-400">Log Working Time</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">Start Time</label>
                    <Input
                      placeholder="10:00 AM"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">End Time</label>
                    <Input
                      placeholder="01:00 PM"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">Total Hours</label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="3.0"
                      value={logHours}
                      onChange={(e) => setLogHours(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-dim">Work Summary</label>
                  <Textarea
                    placeholder="Created dashboard widgets and integrated APIs."
                    value={timeLogSummary}
                    onChange={(e) => setTimeLogSummary(e.target.value)}
                    className="text-xs h-16"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTimeLogForm(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-500">
                    Save Time Log
                  </Button>
                </div>
              </form>
            )}

            {/* Time Logs Table */}
            {detailedTask.timeLogs && detailedTask.timeLogs.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-text-dim uppercase font-semibold">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Hours</th>
                      <th className="p-3">Summary / Notes</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detailedTask.timeLogs.map((l) => (
                      <tr key={l.id} className="hover:bg-card-hover/40">
                        <td className="p-3 font-semibold text-text">{l.user.firstName} {l.user.lastName}</td>
                        <td className="p-3 text-text-dim font-mono">{new Date(l.date).toLocaleDateString()}</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{(l.minutes / 60).toFixed(1)} hrs</td>
                        <td className="p-3 text-text">{l.note || "No details"}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {l.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-xs italic text-text-dim">
                No time logs recorded yet. Time logs are required before completing this task.
              </p>
            )}
          </div>
        )}

        {/* PANEL 4: BUGS PANEL */}
        {activeTab === "bugs" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text">Task Bugs Panel</h3>
                <p className="text-xs text-text-dim">
                  Report, fix, and retest bugs discovered on this task
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowBugForm(!showBugForm)}
                className="gap-1 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Report Bug
              </Button>
            </div>

            {/* Bug Creation Form */}
            {showBugForm && (
              <form
                onSubmit={handleCreateBug}
                className="space-y-4 rounded-xl border border-amber-500/30 bg-card p-5 shadow-sm"
              >
                <h4 className="text-sm font-bold text-amber-400">Report New Bug</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">Bug Title *</label>
                    <Input
                      placeholder="e.g. Search not working on Lead filters"
                      value={bugTitle}
                      onChange={(e) => setBugTitle(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">Assign Developer</label>
                    <select
                      value={bugAssigneeId}
                      onChange={(e) => setBugAssigneeId(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text"
                    >
                      <option value="">Select Developer...</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.role.name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">Severity</label>
                    <select
                      value={bugSeverity}
                      onChange={(e) => setBugSeverity(e.target.value as BugSeverity)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text"
                    >
                      {BUG_SEVERITIES.map((sev) => (
                        <option key={sev} value={sev}>
                          {sev}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-dim">Priority</label>
                    <select
                      value={bugPriority}
                      onChange={(e) => setBugPriority(e.target.value as BugPriority)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text"
                    >
                      {BUG_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-dim">Description & Reproduction Steps</label>
                  <Textarea
                    placeholder="Describe what went wrong and steps to reproduce..."
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    className="text-xs h-20"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBugForm(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="text-xs bg-amber-600 hover:bg-amber-500">
                    Log Bug
                  </Button>
                </div>
              </form>
            )}

            {/* Bugs List & Lifecycle Board */}
            {allTaskBugs.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border text-text-dim uppercase font-semibold">
                      <tr>
                        <th className="p-3">Bug #</th>
                        <th className="p-3">Title</th>
                        <th className="p-3">Severity</th>
                        <th className="p-3">Assignee</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allTaskBugs.map((b) => (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBugId(b.id)}
                          className="hover:bg-card-hover/40 cursor-pointer"
                        >
                          <td className="p-3 font-mono font-bold text-amber-400">
                            #{b.bugNumber}
                          </td>
                          <td className="p-3 font-semibold text-text">
                            {b.title}
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
                                BUG_SEVERITY_COLORS[b.severity]
                              }`}
                            >
                              {b.severity}
                            </span>
                          </td>
                          <td className="p-3 text-text-dim">
                            {b.assignee ? `${b.assignee.firstName} ${b.assignee.lastName}` : "Unassigned"}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={b.status === "CLOSED" ? "outline" : "secondary"}
                              className="text-[10px]"
                            >
                              {BUG_STATUS_LABELS[b.status]}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <select
                              value={b.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleUpdateBugStatus(b.id, e.target.value as BugStatus)
                              }
                              className="rounded border border-border bg-background px-2 py-1 text-[11px] text-text"
                            >
                              {BUG_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {BUG_STATUS_LABELS[st]}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bug Detail & Comment Panel */}
                {selectedBug && (
                  <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          Bug #{selectedBug.bugNumber}
                        </span>
                        <h4 className="text-lg font-bold text-text">{selectedBug.title}</h4>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Status: {BUG_STATUS_LABELS[selectedBug.status]}
                      </Badge>
                    </div>

                    <p className="text-xs text-text">{selectedBug.description || "No description."}</p>

                    {/* Bug Comments History */}
                    <div className="space-y-3 pt-2">
                      <h5 className="text-xs font-bold uppercase text-text-dim">Discussion & Activity</h5>
                      {(selectedBug.comments ?? []).map((c) => (
                        <div key={c.id} className="rounded-lg bg-background p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between text-text-dim text-[11px]">
                            <span className="font-semibold text-text">{c.user.firstName} {c.user.lastName}</span>
                            <span>{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-text">{c.content}</p>
                        </div>
                      ))}

                      {/* Add Comment Input */}
                      <div className="flex items-center gap-2 pt-2">
                        <Input
                          placeholder="Write a comment or resolution note..."
                          value={bugCommentText}
                          onChange={(e) => setBugCommentText(e.target.value)}
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddBugComment(selectedBug.id)}
                          className="gap-1 text-xs"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Comment
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-xs italic text-text-dim">
                No bugs reported on this task! Everything looks clean.
              </p>
            )}
          </div>
        )}

        {/* PANEL 5: TESTING & VALIDATION */}
        {activeTab === "testing" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-purple-300">
                    Tester Validation Dashboard
                  </h3>
                  <p className="text-xs text-text-dim">
                    Strict completion checks required before marking task Completed
                  </p>
                </div>
                <Badge
                  variant={canCompleteTask ? "default" : "outline"}
                  className={canCompleteTask ? "bg-emerald-600 text-white" : "text-amber-400 border-amber-400/30"}
                >
                  {canCompleteTask ? "Validation Passed" : "Validation Pending"}
                </Badge>
              </div>

              {/* Validation Checklist Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Check 1: Dev Work Finished */}
                <div className={`flex items-start gap-3 rounded-lg border p-4 ${isReadyForTesting || detailedTask.status === "DONE" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                  {isReadyForTesting || detailedTask.status === "DONE" ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <strong className="font-bold">1. Development Work Finished</strong>
                    <p>
                      Task status must be marked &quot;Ready for Testing&quot;. Current: {TASK_STATUS_LABELS[detailedTask.status]}.
                    </p>
                  </div>
                </div>

                {/* Check 2: Daily Updates Logged */}
                <div className={`flex items-start gap-3 rounded-lg border p-4 ${hasDailyUpdates ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                  {hasDailyUpdates ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <strong className="font-bold">2. Daily Progress Updates</strong>
                    <p>
                      {hasDailyUpdates
                        ? "At least one daily progress update recorded."
                        : "No daily progress update logged yet."}
                    </p>
                  </div>
                </div>

                {/* Check 3: Time Logs Submitted */}
                <div className={`flex items-start gap-3 rounded-lg border p-4 ${hasTimeLogs ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                  {hasTimeLogs ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <strong className="font-bold">3. Working Time Logged</strong>
                    <p>
                      {hasTimeLogs
                        ? `Total logged time: ${(totalLoggedMinutes / 60).toFixed(1)} hrs.`
                        : "No time logged yet."}
                    </p>
                  </div>
                </div>

                {/* Check 4: All Bugs Closed */}
                <div className={`flex items-start gap-3 rounded-lg border p-4 ${allBugsClosed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive font-bold"}`}>
                  {allBugsClosed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <strong className="font-bold">4. Bug Resolution Check</strong>
                    <p>
                      {allBugsClosed
                        ? "All reported bugs are CLOSED."
                        : `${openBugsCount} unresolved bug(s) remaining! All bugs must be CLOSED.`}
                    </p>
                  </div>
                </div>

                {/* Check 5: Subtasks Completed */}
                <div className={`flex items-start gap-3 rounded-lg border p-4 ${allSubtasksDone ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                  {allSubtasksDone ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <strong className="font-bold">5. Subtasks Completion Rule</strong>
                    <p>
                      {allSubtasksDone
                        ? "All child subtasks are COMPLETED."
                        : "Incomplete subtasks remaining."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Trigger */}
              <div className="flex justify-end pt-4 border-t border-purple-500/20">
                <Button
                  disabled={!canCompleteTask || detailedTask.status === "DONE"}
                  onClick={() => handleStatusChange("DONE")}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {detailedTask.status === "DONE"
                    ? "Task Successfully Completed"
                    : "Approve & Mark Task Completed"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 6: AUDIT HISTORY */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-text">Activity Timeline</h3>
            {detailedTask.activityLogs && detailedTask.activityLogs.length > 0 ? (
              <div className="relative border-l border-border pl-6 space-y-6">
                {detailedTask.activityLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px]">
                      •
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-text">{log.action}</span>
                        <span className="text-[11px] text-text-dim font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-text">{log.details}</p>
                      <span className="text-[11px] text-text-dim">
                        By: {log.user.firstName} {log.user.lastName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs italic text-text-dim">
                No activity logs recorded yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
