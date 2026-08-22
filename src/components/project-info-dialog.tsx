import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Calendar,
  Github,
  Key,
  Users,
  KanbanSquare,
  ArrowRight,
  Edit3,
  CheckCircle2,
  Clock,
  Building2,
  Copy,
  Check,
  Eye,
  EyeOff,
  User as UserIcon,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useProject } from "@/hooks/use-projects";
import { useDepartments } from "@/hooks/use-departments";
import { useAuthStore } from "@/stores/auth-store";
import type { Project, ProjectStatus } from "@/lib/api/types";
import { ProjectFormDialog } from "@/components/project-form-dialog";

interface ProjectInfoDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_TONE: Record<ProjectStatus, string> = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  ON_HOLD: "bg-warning/10 text-warning border-warning/20",
  COMPLETED: "bg-info/10 text-info border-info/20",
  ARCHIVED: "bg-panel-elevated text-text-dim border-border-subtle",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export function ProjectInfoDialog({ project, open, onOpenChange }: ProjectInfoDialogProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const canEdit = currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";

  const { data: departments } = useDepartments();
  const { data: detail } = useProject(open && project ? project.id : undefined);
  const activeProject = detail ?? project;

  const departmentName =
    departments?.find((d) => d.id === activeProject?.departmentId)?.name ?? "General / Unassigned";

  const [editOpen, setEditOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  if (!project) return null;

  const tasks = detail?.tasks ?? [];
  const totalTasks = tasks.length > 0 ? tasks.length : (project._count?.tasks ?? 0);
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const todoTasks = tasks.filter((t) => t.status === "TODO").length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleCopyKey = () => {
    if (activeProject?.projectPassword) {
      navigator.clipboard.writeText(activeProject.projectPassword);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleOpenBoard = () => {
    onOpenChange(false);
    navigate({ to: "/projects/$id", params: { id: project.id } });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
                  <KanbanSquare className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight">
                    {activeProject?.name}
                  </DialogTitle>
                  <p className="text-xs text-text-dim mt-0.5">Project Overview & Information</p>
                </div>
              </div>
              {activeProject && (
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                    STATUS_TONE[activeProject.status]
                  }`}
                >
                  {STATUS_LABEL[activeProject.status]}
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Description */}
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-text-dim">
                Description
              </span>
              <p className="text-sm text-foreground/90 leading-relaxed bg-canvas/40 border border-border-subtle p-3 rounded-lg">
                {activeProject?.description || "No description provided for this project."}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-panel-elevated/40 border border-border-subtle p-3 rounded-lg space-y-1">
                <span className="text-text-dim text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1">
                  <UserIcon className="size-3" /> Project Owner
                </span>
                <p className="font-semibold text-sm">
                  {activeProject?.owner?.firstName} {activeProject?.owner?.lastName}
                </p>
              </div>

              <div className="bg-panel-elevated/40 border border-border-subtle p-3 rounded-lg space-y-1">
                <span className="text-text-dim text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1">
                  <Building2 className="size-3" /> Department
                </span>
                <p className="font-semibold text-sm">
                  {departmentName}
                </p>
              </div>

              <div className="bg-panel-elevated/40 border border-border-subtle p-3 rounded-lg space-y-1">
                <span className="text-text-dim text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1">
                  <Calendar className="size-3" /> Start Date
                </span>
                <p className="font-medium">
                  {activeProject?.startDate
                    ? new Date(activeProject.startDate).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "Not specified"}
                </p>
              </div>

              <div className="bg-panel-elevated/40 border border-border-subtle p-3 rounded-lg space-y-1">
                <span className="text-text-dim text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1">
                  <Clock className="size-3" /> Due Date
                </span>
                <p className="font-medium">
                  {activeProject?.dueDate
                    ? new Date(activeProject.dueDate).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "No deadline"}
                </p>
              </div>
            </div>

            {/* Task Progress Bar */}
            <div className="space-y-2 bg-panel border border-border-subtle p-3.5 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" /> Task Progress
                </span>
                <span className="font-semibold text-primary">{progressPercent}% Completed</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center justify-between text-[11px] text-text-dim pt-1">
                <span>Total: <b>{totalTasks}</b></span>
                <span>To Do: <b>{todoTasks}</b></span>
                <span>In Progress: <b>{inProgressTasks}</b></span>
                <span>Completed: <b>{completedTasks}</b></span>
              </div>
            </div>

            {/* Repository & Environment Key */}
            {(activeProject?.githubUrl || activeProject?.projectPassword) && (
              <div className="space-y-2 bg-panel-elevated/50 border border-border-subtle p-3.5 rounded-lg text-xs space-y-3">
                {activeProject.githubUrl && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-1">
                      <Github className="size-3" /> GitHub Repository
                    </span>
                    <a
                      href={activeProject.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium break-all flex items-center gap-1.5"
                    >
                      {activeProject.githubUrl}
                    </a>
                  </div>
                )}

                {activeProject.projectPassword && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-1">
                      <Key className="size-3" /> Environment Key / Password
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-canvas border border-border-subtle px-2.5 py-1 rounded text-xs font-mono text-warning select-all truncate">
                        {showPassword ? activeProject.projectPassword : "••••••••••••••••"}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={handleCopyKey}
                      >
                        {copiedKey ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Team Members */}
            {detail?.members && detail.members.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-text-dim flex items-center gap-1">
                  <Users className="size-3" /> Team Collaborators ({detail.members.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {detail.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 bg-canvas border border-border-subtle px-2.5 py-1 rounded-full text-xs"
                    >
                      <Avatar className="size-5">
                        <AvatarFallback className="text-[9px]">
                          {member.firstName[0]}
                          {member.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {member.firstName} {member.lastName}
                      </span>
                      {member.githubUsername && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 px-1 gap-0.5">
                          <Github className="size-2.5" />
                          {member.githubUsername}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between w-full">
              <div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      setEditOpen(true);
                    }}
                    className="gap-1.5 text-xs"
                  >
                    <Edit3 className="size-3.5" />
                    Edit Project
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button type="button" size="sm" onClick={handleOpenBoard} className="gap-1.5">
                  Open Board & Tasks
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog modal */}
      {canEdit && activeProject && (
        <ProjectFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          project={activeProject}
        />
      )}
    </>
  );
}
