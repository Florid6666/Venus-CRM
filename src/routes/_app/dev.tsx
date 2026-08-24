import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Code2,
  GitPullRequest,
  Plus,
  Loader2,
  CheckCircle2,
  Bug,
  Settings,
  AlertCircle,
  Calendar,
  TrendingUp,
  GitFork,
  ChevronRight,
  Play,
  Check,
  CheckSquare,
  Wrench,
  RefreshCw,
  GitCommit as GitCommitIcon,
  MessageSquare,
  Folder,
} from "lucide-react";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { format } from "date-fns/format";
import { parse } from "date-fns/parse";
import { startOfWeek } from "date-fns/startOfWeek";
import { getDay } from "date-fns/getDay";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

import { useAuthStore } from "@/stores/auth-store";
import { useUsers, useUpdateGithubUsername } from "@/hooks/use-users";
import { useAnalyticsSummary } from "@/hooks/use-analytics";
import { useEpics, useCreateEpic } from "@/hooks/use-epics";
import { useReleases, useCreateRelease } from "@/hooks/use-releases";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useTasks, useUpdateTask, useCreateTask } from "@/hooks/use-tasks";
import {
  useSprints,
  useCreateSprint,
  useUpdateSprint,
  useAssignTasksToSprint,
} from "@/hooks/use-sprints";
import { useCommits, useCreateCommit, useMergePR, useDeclinePR } from "@/hooks/use-commits";
import { useSprintTaskUpdates } from "@/hooks/use-task-updates";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { ZohoTaskPagePanel } from "@/components/zoho-task-page-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type GitCommit,
  type SprintTaskUpdate,
  type Task,
  type TaskStatus,
  type TaskType,
} from "@/lib/api/types";
import { formatRelativeDay } from "@/lib/format-relative-day";

export const Route = createFileRoute("/_app/dev")({
  component: DevPage,
});

function DevPage() {
  useDepartmentGuard("Dev");

  const currentUser = useAuthStore((s) => s.user);
  const { data: users } = useUsers();
  const updateGithubUsername = useUpdateGithubUsername();

  // CurrentUser (the auth session) deliberately doesn't carry githubUsername --
  // look it up from the full user record instead.
  const currentUserFull = useMemo(
    () => users?.find((u) => u.id === currentUser?.id),
    [users, currentUser],
  );

  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubUsernameInput, setGithubUsernameInput] = useState(
    currentUserFull?.githubUsername || "",
  );

  // Project Scope Filter
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL_PROJECTS");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Scoped tasks for Dev department
  const { data: tasks, isLoading: tasksLoading } = useTasks({
    departmentId: currentUser?.department?.id,
  });

  const { data: sprints, isLoading: sprintsLoading } = useSprints(
    selectedProjectId === "ALL_PROJECTS" ? undefined : selectedProjectId,
  );
  const { data: commits, isLoading: commitsLoading } = useCommits();
  const { data: analytics } = useAnalyticsSummary();
  const devMetrics = analytics?.dev;
  const { data: epics } = useEpics(currentUser?.department?.id);
  const { data: releases } = useReleases(currentUser?.department?.id);
  const { data: projects } = useProjects({ departmentId: currentUser?.department?.id });

  // Filter tasks dynamically by selected project
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (selectedProjectId === "ALL_PROJECTS") return tasks;
    return tasks.filter(
      (t) => t.projectId === selectedProjectId || t.project?.id === selectedProjectId,
    );
  }, [tasks, selectedProjectId]);

  // Mutations
  const createProject = useCreateProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const assignTasksToSprint = useAssignTasksToSprint();
  const createCommit = useCreateCommit();
  const mergePR = useMergePR();
  const declinePR = useDeclinePR();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"board" | "backlog" | "projects" | "calendar">(
    "board",
  );

  // Create Sprint Dialog State
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");
  const [sprintProjectId, setSprintProjectId] = useState("none");

  // Create Task Dialog State
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskType, setTaskTypeState] = useState<TaskType>("FEATURE");
  const [taskSP, setTaskSP] = useState("1");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("none");
  const [taskParentId, setTaskParentId] = useState("none");

  // Create Project Dialog State
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectDue, setProjectDue] = useState("");

  // Filter open Pull Requests
  const openPRs = useMemo(() => {
    return commits?.filter((c) => c.isPR && c.prStatus === "OPEN") || [];
  }, [commits]);

  // Get active sprint
  const activeSprint = useMemo(() => {
    return sprints?.find((s) => s.status === "ACTIVE") || null;
  }, [sprints]);

  // Real per-task progress updates across the active sprint
  const { data: sprintTaskUpdates, isLoading: sprintUpdatesLoading } = useSprintTaskUpdates(
    activeSprint?.id,
  );

  // Task detail dialog (opened from a sprint board card)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  // Sprint stats
  const sprintStats = useMemo(() => {
    if (!activeSprint) return { totalTasks: 0, completedTasks: 0, totalSP: 0, completedSP: 0 };
    const sprintTasks = filteredTasks.filter((t) => t.sprintId === activeSprint.id);
    const completed = sprintTasks.filter((t) => t.status === "DONE");

    const totalSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);
    const completedSP = completed.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);

    return {
      totalTasks: sprintTasks.length,
      completedTasks: completed.length,
      totalSP,
      completedSP,
    };
  }, [activeSprint, filteredTasks]);

  // Dev teammates (for assignee lists)
  const devTeammates = useMemo(() => {
    if (!users || !currentUser) return [];
    return users.filter((u) => u.department?.id === currentUser.department?.id);
  }, [users, currentUser]);

  // Filter tasks in active sprint vs backlog
  const sprintTasks = useMemo(() => {
    if (!activeSprint) return [];
    return filteredTasks.filter((t) => t.sprintId === activeSprint.id);
  }, [activeSprint, filteredTasks]);

  const backlogTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.sprintId === null);
  }, [filteredTasks]);

  // Group activities by date for Daily Updates
  const dailyUpdates = useMemo(() => {
    const items: Array<
      | { id: string; type: "commit"; date: string; data: GitCommit }
      | { id: string; type: "task"; date: string; data: Task }
      | { id: string; type: "update"; date: string; data: SprintTaskUpdate }
    > = [];

    commits?.forEach((c) => {
      items.push({ id: `commit-${c.id}`, type: "commit", date: c.createdAt, data: c });
    });

    tasks
      ?.filter((t) => t.status === "DONE")
      .forEach((t) => {
        items.push({ id: `task-${t.id}`, type: "task", date: t.updatedAt, data: t });
      });

    sprintTaskUpdates?.forEach((u) => {
      items.push({ id: `update-${u.id}`, type: "update", date: u.createdAt, data: u });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const groups: Array<{ date: string; items: typeof items }> = [];
    items.forEach((item) => {
      const dateKey = formatRelativeDay(item.date);
      let group = groups.find((g) => g.date === dateKey);
      if (!group) {
        group = { date: dateKey, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });

    return groups;
  }, [commits, tasks, sprintTaskUpdates]);

  // Backlog selections for sprint planning
  const [selectedBacklogTaskIds, setSelectedBacklogTaskIds] = useState<Record<string, boolean>>({});

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim() || !sprintStart || !sprintEnd) return;
    try {
      await createSprint.mutateAsync({
        name: sprintName,
        startDate: sprintStart,
        endDate: sprintEnd,
        status: "ACTIVE", // Automatically start the created sprint
        projectId: sprintProjectId !== "none" ? sprintProjectId : undefined,
      });
      setCreateSprintOpen(false);
      setSprintName("");
      setSprintStart("");
      setSprintEnd("");
      setSprintProjectId("none");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        type: taskType,
        storyPoints: parseInt(taskSP, 10),
        assigneeId: taskAssigneeId || undefined,
        departmentId: currentUser?.department?.id ?? undefined,
        sprintId: activeSprint?.id || undefined,
        dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
        projectId: taskProjectId !== "none" ? taskProjectId : undefined,
        parentId: taskParentId !== "none" ? taskParentId : undefined,
      });
      setCreateTaskOpen(false);
      setTaskTitle("");
      setTaskDesc("");
      setTaskTypeState("FEATURE");
      setTaskSP("1");
      setTaskAssigneeId("");
      setTaskDueDate("");
      setTaskProjectId("none");
      setTaskParentId("none");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    try {
      await createProject.mutateAsync({
        name: projectName,
        description: projectDesc || undefined,
        dueDate: projectDue ? new Date(projectDue).toISOString() : undefined,
        departmentId: currentUser?.department?.id ?? undefined,
        status: "ACTIVE",
      });
      setCreateProjectOpen(false);
      setProjectName("");
      setProjectDesc("");
      setProjectDue("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        input: { status: newStatus },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteSprint = async () => {
    if (!activeSprint) return;
    try {
      await updateSprint.mutateAsync({
        id: activeSprint.id,
        input: { status: "COMPLETED" },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToSprint = async () => {
    if (!activeSprint) return;
    const taskIds = Object.keys(selectedBacklogTaskIds).filter((id) => selectedBacklogTaskIds[id]);
    if (taskIds.length === 0) return;
    try {
      await assignTasksToSprint.mutateAsync({
        sprintId: activeSprint.id,
        taskIds,
      });
      setSelectedBacklogTaskIds({});
    } catch (err) {
      console.error(err);
    }
  };

  // Burndown chart calculation
  const burndownData = useMemo(() => {
    if (!activeSprint) return null;
    const start = new Date(activeSprint.startDate).getTime();
    const end = new Date(activeSprint.endDate).getTime();
    const totalDays = Math.max(1, Math.round((end - start) / (24 * 3600 * 1000)));

    // Total story points assigned in sprint
    const totalSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);

    // Compute ideal burndown points
    const idealPoints = Array.from({ length: totalDays + 1 }, (_, i) => {
      const val = Math.max(0, totalSP - (i * totalSP) / totalDays);
      return { day: i, val };
    });

    // Compute actual burndown points
    const completedTasks = sprintTasks.filter((t) => t.status === "DONE");
    const completedSPPerDay = new Array(totalDays + 1).fill(0);
    completedTasks.forEach((t) => {
      const closedTime = t.updatedAt ? new Date(t.updatedAt).getTime() : Date.now();
      const dayIndex = Math.min(
        totalDays,
        Math.max(0, Math.floor((closedTime - start) / (24 * 3600 * 1000))),
      );
      completedSPPerDay[dayIndex] += t.storyPoints ?? 0;
    });

    const actualPoints: { day: number; val: number }[] = [];
    let remainingSP = totalSP;
    const todayIndex = Math.min(
      totalDays,
      Math.max(0, Math.floor((Date.now() - start) / (24 * 3600 * 1000))),
    );

    for (let i = 0; i <= totalDays; i++) {
      if (i <= todayIndex) {
        remainingSP = Math.max(0, remainingSP - completedSPPerDay[i]);
        actualPoints.push({ day: i, val: remainingSP });
      }
    }

    return {
      totalDays,
      totalSP,
      ideal: idealPoints,
      actual: actualPoints,
    };
  }, [activeSprint, sprintTasks]);

  const getTaskTypeIcon = (type: TaskType) => {
    switch (type) {
      case "BUG":
        return <Bug className="size-3.5 text-destructive" />;
      case "REFACTOR":
        return <TrendingUp className="size-3.5 text-violet" />;
      case "CHORE":
        return <Wrench className="size-3.5 text-text-dim" />;
      default:
        return <Code2 className="size-3.5 text-primary" />;
    }
  };

  const getTaskTypeBadge = (type: TaskType) => {
    switch (type) {
      case "BUG":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "REFACTOR":
        return "bg-violet/10 text-violet border-violet/20";
      case "CHORE":
        return "bg-canvas/50 text-text-dim border-border-subtle";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  if (selectedTaskId) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <ZohoTaskPagePanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Development Workspace</h1>
          <p className="text-xs text-text-dim mt-0.5">
            Agile sprints, backlog planning, and developer code commit feed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Project Scope Filter */}
          <div className="flex items-center gap-1.5 bg-panel border border-border px-3 py-1 rounded-lg">
            <Folder className="size-3.5 text-primary" />
            <span className="text-xs text-text-dim font-medium">Project:</span>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-7 w-[180px] text-xs border-0 bg-transparent focus:ring-0 p-0 font-semibold text-text">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_PROJECTS">All Projects (Global)</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentUser && !currentUserFull?.githubUsername && (
            <Button
              onClick={() => {
                setGithubUsernameInput("");
                setGithubDialogOpen(true);
              }}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-warning border-warning/30 hover:bg-warning/10"
            >
              <AlertCircle className="size-3.5" />
              Set GitHub Username
            </Button>
          )}
          {currentUser && currentUserFull?.githubUsername && (
            <Button
              onClick={() => {
                setGithubUsernameInput(currentUserFull.githubUsername || "");
                setGithubDialogOpen(true);
              }}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-text-dim"
            >
              <Settings className="size-3.5" />
              GitHub: {currentUserFull.githubUsername}
            </Button>
          )}
          <Button onClick={() => setCreateTaskOpen(true)} size="sm" className="gap-1.5 text-xs">
            <Plus className="size-3.5" />
            Create Task
          </Button>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Sprints Board & Backlog */}
        <div className="lg:col-span-3 space-y-6">
          {/* PR Approvals Queue */}
          {openPRs.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
              <div className="flex items-center gap-2 select-none border-b border-warning/15 pb-2">
                <GitPullRequest className="size-4 text-warning animate-pulse" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-warning">
                  Pending PR Reviews & Merge Queue ({openPRs.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {openPRs.map((pr) => (
                  <div
                    key={pr.id}
                    className="bg-panel border border-border rounded-lg p-3 flex flex-col justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[9px] text-text-dim">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-primary">PR #{pr.prNumber}</span>
                          {pr.buildStatus === "SUCCESS" && (
                            <CheckCircle2 className="size-3 text-green-500" />
                          )}
                          {pr.buildStatus === "FAILURE" && (
                            <AlertCircle className="size-3 text-red-500" />
                          )}
                          {pr.buildStatus === "PENDING" && (
                            <Loader2 className="size-3 text-amber-500 animate-spin" />
                          )}
                        </div>
                        <span>
                          by {pr.author.firstName} {pr.author.lastName}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold leading-snug mt-1 truncate">
                        {pr.message}
                      </h3>
                      <div className="flex items-center gap-1 mt-1.5 text-[9px] text-text-dim font-mono">
                        <GitFork className="size-2.5 text-cyan-500" />
                        <span>
                          branch: <span className="text-cyan-500 font-semibold">{pr.branch}</span>
                        </span>
                      </div>
                      {pr.task && (
                        <p className="text-[10px] text-text-dim mt-1.5 bg-canvas/30 px-1.5 py-0.5 rounded truncate">
                          Linked Task:{" "}
                          <span className="font-semibold text-primary mr-1">
                            DEV-{pr.task.taskNumber}
                          </span>
                          <span className="font-semibold text-text">{pr.task.title}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] text-text-dim hover:text-destructive"
                        onClick={async () => {
                          try {
                            await declinePR.mutateAsync(pr.id);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        disabled={declinePR.isPending || mergePR.isPending}
                      >
                        Decline
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={async () => {
                          try {
                            await mergePR.mutateAsync(pr.id);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        disabled={declinePR.isPending || mergePR.isPending}
                      >
                        {mergePR.isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          "Merge & Close"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Sprint Banner */}
          <div className="rounded-xl border border-border bg-panel p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-5 text-primary" />
                    <div>
                      <h2 className="text-sm font-semibold">
                        {activeSprint ? activeSprint.name : "No Active Sprint"}
                      </h2>
                      {activeSprint && (
                        <span className="text-[10px] text-text-dim">
                          Ends on {new Date(activeSprint.endDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {activeSprint ? (
                    <Button
                      onClick={handleCompleteSprint}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                    >
                      Complete Sprint
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCreateSprintOpen(true)}
                      size="sm"
                      className="text-xs gap-1.5"
                    >
                      <Play className="size-3.5" />
                      Start Sprint
                    </Button>
                  )}
                </div>

                {activeSprint && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-border-subtle items-center">
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-dim block uppercase">
                        Story Points
                      </span>
                      <span className="text-lg font-bold">
                        {sprintStats.completedSP} / {sprintStats.totalSP} SP
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-dim block uppercase">
                        Tasks Status
                      </span>
                      <span className="text-lg font-bold">
                        {sprintStats.completedTasks} / {sprintStats.totalTasks} Done
                      </span>
                    </div>
                    <div className="col-span-2 space-y-1.5 self-center">
                      <div className="flex items-center justify-between text-[10px] text-text-dim">
                        <span>Progress</span>
                        <span>
                          {sprintStats.totalSP > 0
                            ? Math.round((sprintStats.completedSP / sprintStats.totalSP) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden border border-border-subtle">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${sprintStats.totalSP > 0 ? (sprintStats.completedSP / sprintStats.totalSP) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-1 flex justify-center border-t md:border-t-0 md:border-l border-border-subtle pt-4 md:pt-0 md:pl-6">
                {burndownData ? (
                  <div className="flex flex-col items-center justify-center p-2 bg-canvas/20 rounded-lg border border-border-subtle w-full max-w-[200px]">
                    <span className="text-[9px] font-bold text-text-dim mb-1.5 uppercase select-none">
                      Sprint Burndown
                    </span>
                    <svg
                      width="150"
                      height="75"
                      className="overflow-visible font-mono text-[7px] text-text-dim"
                    >
                      {/* Gridlines */}
                      <line
                        x1="10"
                        y1="5"
                        x2="140"
                        y2="5"
                        stroke="var(--border-subtle)"
                        strokeDasharray="2"
                      />
                      <line x1="10" y1="65" x2="140" y2="65" stroke="var(--border-subtle)" />

                      {/* Ideal Path */}
                      <path
                        d={`M ${burndownData.ideal.map((p) => `${10 + (p.day * 130) / burndownData.totalDays},${burndownData.totalSP > 0 ? 65 - (p.val * 60) / burndownData.totalSP : 65}`).join(" L ")}`}
                        fill="none"
                        stroke="var(--text-dim)"
                        strokeWidth="1.5"
                        strokeDasharray="3"
                      />

                      {/* Actual Path */}
                      {burndownData.actual.length > 0 && (
                        <path
                          d={`M ${burndownData.actual.map((p) => `${10 + (p.day * 130) / burndownData.totalDays},${burndownData.totalSP > 0 ? 65 - (p.val * 60) / burndownData.totalSP : 65}`).join(" L ")}`}
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth="2"
                        />
                      )}

                      {/* Interactive Dots */}
                      {burndownData.actual.map((p, index) => (
                        <circle
                          key={index}
                          cx={10 + (p.day * 130) / burndownData.totalDays}
                          cy={
                            burndownData.totalSP > 0 ? 65 - (p.val * 60) / burndownData.totalSP : 65
                          }
                          r="2.5"
                          className="fill-primary stroke-background"
                          strokeWidth="1"
                        />
                      ))}
                    </svg>
                    <div className="flex justify-between w-full px-2 text-[8px] text-text-dim font-bold font-mono mt-1 font-sans">
                      <span>Day 1</span>
                      <span>D{burndownData.totalDays}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <span className="text-[10px] text-text-dim">No chart data</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border-subtle gap-4 text-xs font-semibold select-none">
            <button
              onClick={() => setActiveTab("board")}
              className={`pb-2 border-b-2 px-1 transition-all ${
                activeTab === "board"
                  ? "border-primary text-text font-bold"
                  : "border-transparent text-text-dim hover:text-text"
              }`}
            >
              Sprint Board
            </button>
            <button
              onClick={() => setActiveTab("backlog")}
              className={`pb-2 border-b-2 px-1 transition-all flex items-center gap-1.5 ${
                activeTab === "backlog"
                  ? "border-primary text-text font-bold"
                  : "border-transparent text-text-dim hover:text-text"
              }`}
            >
              Backlog Planning
              <span className="bg-canvas border border-border-subtle px-1.5 py-0.5 rounded text-[10px]">
                {backlogTasks.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("projects")}
              className={`pb-2 border-b-2 px-1 transition-all ${
                activeTab === "projects"
                  ? "border-primary text-text font-bold"
                  : "border-transparent text-text-dim hover:text-text"
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setActiveTab("calendar")}
              className={`pb-2 border-b-2 px-1 transition-all ${
                activeTab === "calendar"
                  ? "border-primary text-text font-bold"
                  : "border-transparent text-text-dim hover:text-text"
              }`}
            >
              Calendar
            </button>
          </div>

          {/* Sprint Board Column Layout */}
          {activeTab === "board" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {TASK_STATUSES.map((status) => {
                const columnTasks = sprintTasks.filter((t) => t.status === status && !t.parentId);
                return (
                  <div
                    key={status}
                    className="flex flex-col bg-canvas border border-border-subtle rounded-xl p-3 space-y-3 min-h-[300px]"
                  >
                    <div className="flex items-center justify-between border-b border-border-subtle pb-2 select-none">
                      <span className="text-xs font-bold tracking-wide uppercase">
                        {TASK_STATUS_LABELS[status]}
                      </span>
                      <span className="text-[10px] bg-panel border border-border-subtle px-1.5 py-0.5 rounded font-bold text-text-dim">
                        {columnTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0)} SP
                      </span>
                    </div>

                    <ScrollArea className="flex-1 space-y-2.5 max-h-[500px] pr-1">
                      {columnTasks.length === 0 ? (
                        <p className="text-[10px] text-text-dim text-center py-6">Empty</p>
                      ) : (
                        columnTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="bg-panel border border-border hover:border-primary/40 rounded-lg p-3 space-y-2.5 shadow-sm transition-all cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              {getTaskTypeIcon(task.type)}
                              <span className="text-xs font-semibold leading-snug break-words flex-1">
                                <span className="text-primary font-bold mr-1">
                                  DEV-{task.taskNumber}
                                </span>
                                {task.title}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 border rounded-md text-[8px] font-bold font-mono ${getTaskTypeBadge(task.type)}`}
                                >
                                  {TASK_TYPE_LABELS[task.type]}
                                </span>
                                <span className="font-bold text-text-dim">
                                  {task.storyPoints ?? 0} SP
                                </span>
                              </div>

                              <Avatar className="size-4 shrink-0 bg-primary/10 border border-primary/20">
                                <AvatarFallback className="text-[7px]">
                                  {task.assignee
                                    ? `${task.assignee.firstName[0]}${task.assignee.lastName[0]}`
                                    : "?"}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            {task.dueDate && (
                              <div
                                className={`text-[9px] font-bold flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? "text-red-400" : "text-text-dim"}`}
                              >
                                🗓️ Due:{" "}
                                {new Date(task.dueDate).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </div>
                            )}

                            {/* Progress updates indicator -- this task runs across multiple
                                days, so surface how much daily progress has been logged */}
                            <div className="flex items-center gap-1 text-[9px] text-text-dim">
                              <MessageSquare className="size-3 shrink-0" />
                              {task._count.updates > 0 ? (
                                <span className="truncate">
                                  <span className="font-bold text-text">{task._count.updates}</span>{" "}
                                  update{task._count.updates !== 1 ? "s" : ""}
                                  {task.updates[0] && (
                                    <span className="text-text-dim">
                                      {" "}
                                      · last: {task.updates[0].content.slice(0, 40)}
                                      {task.updates[0].content.length > 40 ? "…" : ""}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="italic">No progress logged yet</span>
                              )}
                            </div>

                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="pt-2 mt-2 border-t border-border-subtle space-y-1.5">
                                <div className="text-[8px] font-bold text-text-dim uppercase tracking-wider">
                                  Sub-tasks
                                </div>
                                {task.subtasks.map((sub) => (
                                  <div
                                    key={sub.id}
                                    className="flex items-center gap-1.5 text-[9px] bg-background/50 p-1.5 rounded border border-border-subtle"
                                  >
                                    <span className="text-primary font-bold">
                                      DEV-{sub.taskNumber}
                                    </span>
                                    <span
                                      className={`truncate flex-1 ${sub.status === "DONE" ? "line-through text-text-dim" : "text-text"}`}
                                    >
                                      {sub.title}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Dropdown status update for demo/accessibility */}
                            <div
                              className="pt-2 border-t border-border-subtle flex justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Select
                                value={task.status}
                                onValueChange={(v) =>
                                  handleMoveTaskStatus(task.id, v as TaskStatus)
                                }
                              >
                                <SelectTrigger className="h-6 text-[9px] w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TASK_STATUSES.map((st) => (
                                    <SelectItem key={st} value={st} className="text-[9px]">
                                      {TASK_STATUS_LABELS[st]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </div>
                );
              })}
            </div>
          )}

          {/* Backlog View */}
          {activeTab === "backlog" && (
            <div className="space-y-4">
              <div className="bg-panel border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <p className="text-xs text-text-dim">
                  Select items from your backlog to plan and allocate them to the active sprint.
                </p>
                {activeSprint ? (
                  <Button
                    onClick={handleAddToSprint}
                    disabled={Object.values(selectedBacklogTaskIds).filter(Boolean).length === 0}
                    size="sm"
                    className="text-xs gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Move to Sprint
                  </Button>
                ) : (
                  <span className="text-[10px] text-warning bg-warning/5 border border-warning/20 px-2.5 py-1 rounded">
                    Start a sprint first to plan backlog items.
                  </span>
                )}
              </div>

              <div className="border border-border rounded-xl bg-panel overflow-hidden">
                {backlogTasks.length === 0 ? (
                  <div className="p-8 text-center text-text-dim space-y-1.5">
                    <CheckSquare className="size-8 text-primary/30 mx-auto" />
                    <p className="text-xs font-semibold">Backlog is empty</p>
                    <p className="text-[10px]">Create new tasks above to fill the backlog.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {backlogTasks
                      .filter((t) => !t.parentId)
                      .map((task) => {
                        const isSelected = !!selectedBacklogTaskIds[task.id];
                        return (
                          <div
                            key={task.id}
                            className="p-3.5 flex items-center gap-3 hover:bg-canvas/30 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                setSelectedBacklogTaskIds((prev) => ({
                                  ...prev,
                                  [task.id]: e.target.checked,
                                }))
                              }
                              className="size-3.5 rounded border-border text-primary shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {getTaskTypeIcon(task.type)}
                                <span className="text-xs font-semibold truncate text-text">
                                  <span className="text-primary font-bold mr-1.5">
                                    DEV-{task.taskNumber}
                                  </span>
                                  {task.title}
                                </span>
                              </div>
                              {task.description && (
                                <p className="text-[10px] text-text-dim truncate mt-0.5 max-w-xl">
                                  {task.description}
                                </p>
                              )}

                              {task.subtasks && task.subtasks.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {task.subtasks.map((sub) => (
                                    <div
                                      key={sub.id}
                                      className="flex items-center gap-1.5 text-[9px] bg-canvas/30 w-fit pr-3 pl-1.5 py-0.5 rounded border border-border-subtle"
                                    >
                                      <span className="text-primary font-bold">
                                        DEV-{sub.taskNumber}
                                      </span>
                                      <span
                                        className={`truncate ${sub.status === "DONE" ? "line-through text-text-dim" : "text-text"}`}
                                      >
                                        {sub.title}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0 select-none">
                              {task.dueDate && (
                                <div
                                  className={`text-[9px] font-bold ${new Date(task.dueDate) < new Date() ? "text-red-400" : "text-text-dim"}`}
                                >
                                  🗓️{" "}
                                  {new Date(task.dueDate).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                              )}
                              <span
                                className={`px-1.5 py-0.5 border rounded text-[8px] font-bold font-mono ${getTaskTypeBadge(task.type)}`}
                              >
                                {TASK_TYPE_LABELS[task.type]}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold">
                                  {task.storyPoints ?? 0} SP
                                </span>
                                {/* Story Point Slider/Selector */}
                                <Select
                                  value={String(task.storyPoints ?? 1)}
                                  onValueChange={(v) =>
                                    updateTask.mutate({
                                      id: task.id,
                                      input: { storyPoints: parseInt(v, 10) },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-6 w-12 text-[9px] p-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 5, 8, 13].map((sp) => (
                                      <SelectItem
                                        key={sp}
                                        value={String(sp)}
                                        className="text-[9px]"
                                      >
                                        {sp}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <Select
                                value={task.type}
                                onValueChange={(v) =>
                                  updateTask.mutate({
                                    id: task.id,
                                    input: { type: v as TaskType },
                                  })
                                }
                              >
                                <SelectTrigger className="h-6 w-20 text-[9px] p-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TASK_TYPES.map((t) => (
                                    <SelectItem key={t} value={t} className="text-[9px]">
                                      {TASK_TYPE_LABELS[t]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Projects View */}
          {activeTab === "projects" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <h3 className="text-sm font-bold">Projects</h3>
                <Button
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => setCreateProjectOpen(true)}
                >
                  <Plus className="size-3 mr-1" /> Create Project
                </Button>
              </div>
              {projects?.length === 0 ? (
                <p className="text-xs text-text-dim bg-panel border border-border p-8 text-center rounded-xl">
                  No projects found for your department.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects?.map((p) => (
                    <div
                      key={p.id}
                      className="bg-panel border border-border p-4 rounded-xl space-y-2"
                    >
                      <h4 className="text-xs font-bold text-primary">{p.name}</h4>
                      <p className="text-[10px] text-text-dim min-h-[30px]">{p.description}</p>
                      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border-subtle">
                        <span className="font-semibold px-1.5 py-0.5 rounded border border-border-subtle bg-canvas">
                          {p.status}
                        </span>
                        {p.dueDate && <span>Due: {new Date(p.dueDate).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Calendar View */}
          {activeTab === "calendar" && (
            <div className="bg-panel border border-border p-4 rounded-xl h-[600px] overflow-hidden">
              <h3 className="text-sm font-bold border-b border-border-subtle pb-2 mb-4">
                Calendar
              </h3>
              <div className="h-[500px]">
                <BigCalendar
                  localizer={localizer}
                  events={
                    tasks
                      ?.filter((t) => t.dueDate)
                      .map((t) => ({
                        title: `DEV-${t.taskNumber} ${t.title}`,
                        start: new Date(t.dueDate!),
                        end: new Date(t.dueDate!),
                        allDay: true,
                      })) || []
                  }
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: "100%" }}
                  className="text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Daily Updates Feed */}
        <div className="space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col h-[calc(100vh-190px)] min-h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 select-none">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="size-4 text-cyan-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-200 font-mono">
                  Daily Updates Feed
                </span>
              </div>
              <span className="text-[8px] bg-slate-800 px-1.5 py-0.5 rounded text-cyan-400 font-mono uppercase tracking-wider">
                live sync
              </span>
            </div>

            <ScrollArea className="flex-1 pr-1 font-mono text-[10px] leading-relaxed">
              {(commitsLoading || sprintUpdatesLoading) && (
                <p className="text-slate-500 py-4 text-center">Loading feed...</p>
              )}
              {!commitsLoading && !sprintUpdatesLoading && dailyUpdates.length === 0 && (
                <div className="py-20 text-center text-slate-600">
                  <p>no daily activity yet</p>
                </div>
              )}
              <div className="space-y-6">
                {dailyUpdates.map((group) => (
                  <div key={group.date} className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded inline-block">
                      {group.date}
                    </h4>
                    <div className="space-y-3.5 pl-2 border-l-2 border-slate-800 ml-1">
                      {group.items.map((item) => (
                        <div key={item.id} className="pb-3 space-y-1 relative">
                          <div className="absolute -left-[11px] top-1.5 size-2 rounded-full bg-slate-700 border-2 border-slate-950" />

                          {item.type === "commit" && (
                            <>
                              <div className="flex items-center justify-between text-[9px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-green-500 hover:underline cursor-pointer">
                                    {item.data.author.firstName} {item.data.author.lastName}
                                  </span>
                                  {item.data.buildStatus === "SUCCESS" && (
                                    <CheckCircle2 className="size-3 text-green-500" />
                                  )}
                                  {item.data.buildStatus === "FAILURE" && (
                                    <AlertCircle className="size-3 text-red-500" />
                                  )}
                                  {item.data.buildStatus === "PENDING" && (
                                    <Loader2 className="size-3 text-amber-500 animate-spin" />
                                  )}
                                </div>
                                <span className="text-slate-500 font-semibold">
                                  {item.data.hash}
                                </span>
                              </div>
                              <p className="text-slate-300 break-words font-semibold leading-tight">
                                {item.data.message}
                              </p>
                              <div className="flex items-center justify-between text-[8px] text-slate-500 pt-0.5">
                                <span className="text-cyan-500 flex items-center gap-0.5 font-bold">
                                  <GitFork className="size-2" />
                                  {item.data.branch}
                                </span>
                                <span>
                                  {new Date(item.data.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              {item.data.task && (
                                <div className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 mt-1.5 flex items-center justify-between text-[8px]">
                                  <span className="text-slate-400 truncate max-w-[130px]">
                                    Task:{" "}
                                    <span className="font-semibold text-primary mr-1">
                                      DEV-{item.data.task.taskNumber}
                                    </span>{" "}
                                    {item.data.task.title}
                                  </span>
                                  <span className="text-primary font-bold">
                                    {item.data.task.status}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {item.type === "task" && (
                            <>
                              <div className="flex items-center justify-between text-[9px]">
                                <span className="text-primary hover:underline cursor-pointer">
                                  {item.data.assignee
                                    ? `${item.data.assignee.firstName} ${item.data.assignee.lastName}`
                                    : "Unassigned"}
                                </span>
                                <span className="text-slate-500 font-semibold flex items-center gap-1">
                                  <CheckSquare className="size-3 text-primary" />
                                  Completed Task
                                </span>
                              </div>
                              <p className="text-slate-300 break-words font-semibold leading-tight">
                                <span className="text-primary mr-1">
                                  DEV-{item.data.taskNumber}
                                </span>
                                {item.data.title}
                              </p>
                              <div className="flex items-center justify-between text-[8px] text-slate-500 pt-0.5">
                                <span className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">
                                  {item.data.type}
                                </span>
                                <span>
                                  {new Date(item.data.updatedAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </>
                          )}

                          {item.type === "update" && (
                            <>
                              <div className="flex items-center justify-between text-[9px]">
                                <span className="text-amber-400 hover:underline cursor-pointer">
                                  {item.data.user.firstName} {item.data.user.lastName}
                                </span>
                                <span className="text-slate-500 font-semibold flex items-center gap-1">
                                  <MessageSquare className="size-3 text-amber-400" />
                                  Progress Update
                                </span>
                              </div>
                              <p className="text-slate-300 break-words leading-tight">
                                {item.data.content}
                              </p>
                              <div className="flex items-center justify-between text-[8px] text-slate-500 pt-0.5">
                                <span className="text-primary font-semibold truncate max-w-[130px]">
                                  DEV-{item.data.task.taskNumber} {item.data.task.title}
                                </span>
                                <span>
                                  {new Date(item.data.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* DIALOGS */}

      {/* Task Detail Dialog (opened from a sprint board card) -- includes
          the Progress Updates log for that task. */}
      {selectedTask && (
        <TaskFormDialog
          open={taskDialogOpen}
          onOpenChange={(open) => {
            setTaskDialogOpen(open);
            if (!open) setSelectedTask(null);
          }}
          task={selectedTask}
        />
      )}

      {/* Create Project Dialog */}
      <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Q3 Website Redesign"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="High level goals..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target Due Date</Label>
              <Input
                type="date"
                value={projectDue}
                onChange={(e) => setProjectDue(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateProjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Start Sprint Dialog */}
      <Dialog open={createSprintOpen} onOpenChange={setCreateSprintOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Sprint</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSprint} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-name">Sprint Name</Label>
              <Input
                id="sprint-name"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder="e.g. Sprint 1 - Core Backend"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sprint-start">Start Date</Label>
                <Input
                  id="sprint-start"
                  type="date"
                  value={sprintStart}
                  onChange={(e) => setSprintStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sprint-end">End Date</Label>
                <Input
                  id="sprint-end"
                  type="date"
                  value={sprintEnd}
                  onChange={(e) => setSprintEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Associated Project</Label>
              <Select value={sprintProjectId} onValueChange={setSprintProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Project (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Specific Project (Global)</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateSprintOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSprint.isPending}>
                {createSprint.isPending ? "Starting..." : "Start Sprint"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Implement JWT refresh endpoint"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Description</Label>
              <Input
                id="task-desc"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Details, acceptance criteria..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={taskType} onValueChange={(v) => setTaskTypeState(v as TaskType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TASK_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Story Points</Label>
                <Select value={taskSP} onValueChange={setTaskSP}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 8, 13].map((sp) => (
                      <SelectItem key={sp} value={String(sp)}>
                        {sp} SP
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Teammate" />
                </SelectTrigger>
                <SelectContent>
                  {devTeammates.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={taskProjectId} onValueChange={setTaskProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Project (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parent Task (Sub-task of)</Label>
              <Select value={taskParentId} onValueChange={setTaskParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Parent Task (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tasks
                    ?.filter((t) => !t.parentId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        DEV-{t.taskNumber} {t.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateTaskOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set GitHub Username Dialog */}
      <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set GitHub Username</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-text-dim">
              Link your GitHub username to automatically sync your commits and PRs to your Venus CRM
              tasks.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="github-username">GitHub Username</Label>
              <Input
                id="github-username"
                value={githubUsernameInput}
                onChange={(e) => setGithubUsernameInput(e.target.value)}
                placeholder="e.g. octocat"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setGithubDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (currentUser) {
                    await updateGithubUsername.mutateAsync({
                      id: currentUser.id,
                      githubUsername: githubUsernameInput.trim() || null,
                    });
                    setGithubDialogOpen(false);
                  }
                }}
                disabled={updateGithubUsername.isPending}
              >
                {updateGithubUsername.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
