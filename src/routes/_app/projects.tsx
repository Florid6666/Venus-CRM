import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KanbanSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { useProjects } from "@/hooks/use-projects";
import { useDepartmentExcludedGuard } from "@/hooks/use-department-guard";
import type { ProjectStatus } from "@/lib/api/types";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsPage,
});

const STATUS_TONE: Record<ProjectStatus, string> = {
  ACTIVE: "text-success",
  ON_HOLD: "text-warning",
  COMPLETED: "text-info",
  ARCHIVED: "text-text-dim",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function ProjectsPage() {
  useDepartmentExcludedGuard("Sales");

  const { data: projects, isLoading } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
            <KanbanSquare className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-text-dim mt-1">Every active initiative, with live task progress.</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          New Project
        </Button>
      </div>

      {isLoading && <p className="text-text-dim text-sm">Loading…</p>}
      {!isLoading && projects?.length === 0 && (
        <div className="bg-panel border border-border-subtle rounded-xl p-8 text-center text-text-dim text-sm">
          No projects yet. Create your first one to get started.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <Link
            key={project.id}
            to="/projects/$id"
            params={{ id: project.id }}
            className="bg-panel border border-border-subtle rounded-xl p-5 hover:border-border transition-colors flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-sm tracking-tight truncate">{project.name}</h2>
              <span
                className={`text-[10px] px-2 py-0.5 rounded bg-panel-elevated shrink-0 ${STATUS_TONE[project.status]}`}
              >
                {STATUS_LABEL[project.status]}
              </span>
            </div>
            {project.description && (
              <p className="text-xs text-text-dim line-clamp-2">{project.description}</p>
            )}
            <div className="flex items-center justify-between text-[11px] text-text-dim mt-auto pt-2">
              <span>
                {project._count.tasks} task{project._count.tasks === 1 ? "" : "s"}
              </span>
              <span>
                {project.owner.firstName} {project.owner.lastName}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <ProjectFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
