import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ListPlus, MessageSquareText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { ZohoTaskPagePanel } from "@/components/zoho-task-page-panel";
import { useProject } from "@/hooks/use-projects";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useCreateTaskList, useDeleteTaskList } from "@/hooks/use-task-lists";
import { useProjectTaskUpdates } from "@/hooks/use-task-updates";
import { useDepartmentExcludedGuard } from "@/hooks/use-department-guard";
import { useAuthStore } from "@/stores/auth-store";
import { formatRelativeDay } from "@/lib/format-relative-day";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type ProjectTask,
  type ProjectTaskUpdate,
  type TaskList,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api/types";

// "2h 30m" / "45m" / "" -- same format as the Tasks page's Duration column
// (see tasks.tsx's formatDuration), duplicated locally rather than shared
// since it's a two-line pure function and these routes don't otherwise
// import from each other.
function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const Route = createFileRoute("/_app/projects/$id")({
  component: ProjectDetailPage,
});

const PRIORITY_TONE: Record<TaskPriority, string> = {
  LOW: "text-text-dim",
  MEDIUM: "text-info",
  HIGH: "text-warning",
  URGENT: "text-destructive",
};

type Columns = Record<TaskStatus, ProjectTask[]>;

function emptyColumns(): Columns {
  return { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], READY_FOR_TESTING: [], CHANGES_REQUIRED: [], DONE: [] };
}

function groupByStatus(tasks: ProjectTask[]): Columns {
  const columns = emptyColumns();
  for (const task of tasks) {
    columns[task.status].push(task);
  }
  for (const status of TASK_STATUSES) {
    columns[status].sort((a, b) => a.position - b.position);
  }
  return columns;
}

function ProjectDetailPage() {
  useDepartmentExcludedGuard("Sales");

  const { id } = useParams({ from: "/_app/projects/$id" });
  const { data: project, isLoading } = useProject(id);
  const updateTask = useUpdateTask();
  const currentUser = useAuthStore((s) => s.user);
  // Closing (or reopening) a task is a manager/admin review step -- see
  // TasksService.assertCanSetStatus, the actual enforcement. Blocking the
  // drag itself (rather than letting it drop then having the backend
  // reject it) avoids the card visually landing in Done while the update
  // silently 403s underneath it.
  const canCloseTasks = currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";

  const [columns, setColumns] = useState<Columns>(emptyColumns());
  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setColumns(groupByStatus(project.tasks));
    }
  }, [project]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function findColumnOf(taskId: string): TaskStatus | undefined {
    return TASK_STATUSES.find((s) => columns[s].some((t) => t.id === taskId));
  }

  function handleDragStart(event: DragStartEvent) {
    const taskId = String(event.active.id);
    const status = findColumnOf(taskId);
    if (status) {
      setActiveTask(columns[status].find((t) => t.id === taskId) ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const sourceStatus = findColumnOf(activeId);
    if (!sourceStatus) return;

    const overId = String(over.id);
    const destStatus = (TASK_STATUSES as string[]).includes(overId)
      ? (overId as TaskStatus)
      : findColumnOf(overId);
    if (!destStatus) return;

    // Same rule as the task dialog's Status field -- only the task's designated
    // Tester (or a Manager/Admin) can close a task (drag into Done) or reopen
    // one (drag out of Done). Refusing the drop here (leaving `columns`
    // untouched) snaps the card back to its original column instead of moving
    // it optimistically and then failing server-side.
    const draggedTask = columns[sourceStatus].find((t) => t.id === activeId);
    const canCloseThisTask = canCloseTasks || draggedTask?.testerId === currentUser?.id;
    if (!canCloseThisTask && (destStatus === "DONE" || sourceStatus === "DONE") && destStatus !== sourceStatus) {
      return;
    }

    setColumns((prev) => {
      const sourceList = [...prev[sourceStatus]];
      const taskIndex = sourceList.findIndex((t) => t.id === activeId);
      if (taskIndex === -1) return prev;
      const [moved] = sourceList.splice(taskIndex, 1);

      const destList = sourceStatus === destStatus ? sourceList : [...prev[destStatus]];
      const overIndex = destList.findIndex((t) => t.id === overId);
      const insertAt = overIndex === -1 ? destList.length : overIndex;
      destList.splice(insertAt, 0, { ...moved, status: destStatus });

      updateTask.mutate({ id: activeId, input: { status: destStatus, position: insertAt } });

      return { ...prev, [sourceStatus]: sourceList, [destStatus]: destList };
    });
  }

  function openCreate() {
    setEditingTaskId(null);
    setDialogOpen(true);
  }

  function openEdit(taskId: string) {
    setEditingTaskId(taskId);
    setDialogOpen(true);
  }

  const editingTask = useMemo(() => {
    if (!editingTaskId || !project) return undefined;
    const task = project.tasks.find((t) => t.id === editingTaskId);
    return task ? { ...task, projectId: project.id } : undefined;
  }, [editingTaskId, project]);

  if (isLoading || !project) {
    return <div className="p-6 text-text-dim text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        All projects
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-text-dim mt-1 max-w-2xl">{project.description}</p>
          )}
          
          {(project.githubUrl || project.projectPassword) && (
            <div className="flex flex-wrap gap-4 mt-3 bg-panel-elevated/50 border border-border-subtle p-2.5 rounded-lg max-w-2xl text-xs">
              {project.githubUrl && (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-text-dim uppercase tracking-wider text-[10px]">Repository:</span>
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-semibold"
                  >
                    {project.githubUrl}
                  </a>
                </div>
              )}
              {project.projectPassword && (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-text-dim uppercase tracking-wider text-[10px]">Environment Key:</span>
                  <code className="bg-canvas border border-border-subtle px-1.5 py-0.5 rounded text-[11px] font-mono text-warning">
                    {project.projectPassword}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New Task
        </Button>
      </div>

      <TaskListsBar projectId={project.id} taskLists={project.taskLists} />

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="updates">Daily Updates</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className={`flex-1 transition-all ${editingTaskId ? "lg:w-1/2" : "w-full"}`}>
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {TASK_STATUSES.map((status) => (
                    <KanbanColumn key={status} status={status} tasks={columns[status]} onTaskClick={setEditingTaskId} />
                  ))}
                </div>
                <DragOverlay>{activeTask && <TaskCard task={activeTask} dragging />}</DragOverlay>
              </DndContext>
            </div>

            {editingTaskId && (
              <div className="lg:w-1/2 rounded-xl border border-border bg-card shadow-lg overflow-hidden h-[75vh]">
                <ZohoTaskPagePanel taskId={editingTaskId} onClose={() => setEditingTaskId(null)} />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="updates" className="mt-4">
          <ProjectDailyUpdatesTab projectId={project.id} onOpenTask={setEditingTaskId} />
        </TabsContent>
      </Tabs>

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultProjectId={project.id}
        lockProject
      />
    </div>
  );
}

// Compact management row for this project's Task Lists (the Zoho-style
// grouping shown on the main Tasks page) -- create/delete here, assign a
// task to one via the Task List field in TaskFormDialog. Deleting a list
// doesn't delete its tasks (Task.taskListId SetNulls).
function TaskListsBar({ projectId, taskLists }: { projectId: string; taskLists: TaskList[] }) {
  const createTaskList = useCreateTaskList();
  const deleteTaskList = useDeleteTaskList();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;
    try {
      await createTaskList.mutateAsync({ projectId, name: name.trim() });
      setName("");
      setAdding(false);
    } catch {
      // form stays open with the typed name so the user can retry
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-text-dim mr-1">Task lists</span>
      {taskLists.map((list) => (
        <span
          key={list.id}
          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-border-subtle bg-canvas/40"
        >
          {list.name}
          <span className="text-text-dim">({list._count.tasks})</span>
          <button
            type="button"
            onClick={() => deleteTaskList.mutate({ id: list.id, projectId })}
            className="text-text-dim hover:text-destructive transition-colors"
            title="Delete list"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="List name"
            className="h-7 text-xs w-32"
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={createTaskList.isPending}>
            Add
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-dashed border-border-subtle text-text-dim hover:text-foreground hover:border-border transition-colors"
        >
          <ListPlus className="size-3" />
          Add list
        </button>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  onTaskClick,
}: {
  status: TaskStatus;
  tasks: ProjectTask[];
  onTaskClick: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className="bg-panel border border-border-subtle rounded-xl p-3 flex flex-col gap-2 min-h-[200px]"
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{TASK_STATUS_LABELS[status]}</span>
        <span className="text-[10px] text-text-dim">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({ task, onClick }: { task: ProjectTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, dragging }: { task: ProjectTask; dragging?: boolean }) {
  const loggedMinutes = task.timeLogs.reduce((sum, l) => sum + l.minutes, 0);
  const latestUpdate = task.updates[0];

  return (
    <div
      className={`bg-canvas/50 border border-border-subtle rounded-lg p-3 cursor-pointer hover:border-border transition-colors ${dragging ? "shadow-xl" : ""}`}
    >
      <p className="text-sm font-medium">{task.title}</p>
      {latestUpdate && (
        <p className="text-[10px] text-text-dim mt-1 line-clamp-2 flex items-start gap-1">
          <MessageSquareText className="size-3 shrink-0 mt-0.5" />
          <span>{latestUpdate.content}</span>
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium ${PRIORITY_TONE[task.priority]}`}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>
          {loggedMinutes > 0 && <span className="text-[10px] text-text-dim">{formatDuration(loggedMinutes)}</span>}
        </div>
        {task.assignee && (
          <Avatar className="size-5">
            <AvatarFallback className="text-[9px]">
              {task.assignee.firstName[0]}
              {task.assignee.lastName[0]}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

// Same day-grouped feed as tasks.tsx's DailyUpdatesTab, scoped to this one
// project instead of the viewer's whole department -- so "what happened on
// this project" is readable as one running history without opening each
// task individually.
function ProjectDailyUpdatesTab({
  projectId,
  onOpenTask,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
}) {
  const { data: updates, isLoading } = useProjectTaskUpdates(projectId);

  const groups = useMemo(() => {
    const byDay: Array<{ day: string; items: ProjectTaskUpdate[] }> = [];
    for (const u of updates ?? []) {
      const day = formatRelativeDay(u.createdAt);
      const group = byDay.find((g) => g.day === day);
      if (group) {
        group.items.push(u);
      } else {
        byDay.push({ day, items: [u] });
      }
    }
    return byDay;
  }, [updates]);

  if (isLoading) {
    return <p className="text-sm text-text-dim py-8 text-center">Loading…</p>;
  }

  if (groups.length === 0) {
    return <p className="text-sm text-text-dim py-8 text-center">No progress updates logged yet on this project.</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.day} className="space-y-2">
          <span className="text-[11px] font-bold text-text-dim bg-panel-elevated px-2 py-0.5 rounded inline-block">
            {group.day}
          </span>
          <div className="space-y-1.5 pl-2 border-l-2 border-border-subtle">
            {group.items.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-lg bg-panel border border-border-subtle flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenTask(u.task.id)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {u.task.title}
                  </button>
                  <p className="text-sm text-foreground/90 mt-1 break-words whitespace-pre-wrap">{u.content}</p>
                  <p className="text-[10px] text-text-dim mt-1">
                    {u.user.firstName} {u.user.lastName} ·{" "}
                    {new Date(u.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
