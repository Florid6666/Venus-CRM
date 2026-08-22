import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KanbanSquare, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { ProjectInfoDialog } from "@/components/project-info-dialog";
import { useProjects } from "@/hooks/use-projects";
import { useDepartmentExcludedGuard } from "@/hooks/use-department-guard";
import type { Project, ProjectStatus } from "@/lib/api/types";

import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_app/projects/")({
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

  const currentUser = useAuthStore((s) => s.user);
  const canCreateProject = currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";

  const { data: projects, isLoading } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const handleOpenInfo = (project: Project) => {
    setSelectedProject(project);
    setInfoOpen(true);
  };

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
        {canCreateProject && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New Project
          </Button>
        )}
      </div>

      {isLoading && <p className="text-text-dim text-sm">Loading…</p>}
      {!isLoading && projects?.length === 0 && (
        <div className="bg-panel border border-border-subtle rounded-xl p-8 text-center text-text-dim text-sm">
          {canCreateProject
            ? "No projects yet. Create your first one to get started."
            : "No projects yet."}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <div
            key={project.id}
            onClick={() => handleOpenInfo(project)}
            className="bg-panel border border-border-subtle rounded-xl p-5 hover:border-primary/50 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 group relative"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-sm tracking-tight truncate group-hover:text-primary transition-colors">
                {project.name}
              </h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium bg-panel-elevated ${STATUS_TONE[project.status]}`}
                >
                  {STATUS_LABEL[project.status]}
                </span>
              </div>
            </div>

            {project.description ? (
              <p className="text-xs text-text-dim line-clamp-2 leading-relaxed">{project.description}</p>
            ) : (
              <p className="text-xs text-text-dim/50 italic">No description provided</p>
            )}

            <div className="flex items-center justify-between text-[11px] text-text-dim mt-auto pt-3 border-t border-border-subtle/60">
              <span className="flex items-center gap-1">
                <KanbanSquare className="size-3.5" />
                {project._count.tasks} task{project._count.tasks === 1 ? "" : "s"}
              </span>

              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {project.owner.firstName} {project.owner.lastName}
                </span>
                <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  Info <Info className="size-3" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ProjectFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ProjectInfoDialog
        project={selectedProject}
        open={infoOpen}
        onOpenChange={setInfoOpen}
      />
    </div>
  );
}
