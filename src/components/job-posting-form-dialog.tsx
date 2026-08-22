import { useEffect, useState, type FormEvent } from "react";
import { Loader2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateJobPosting, useUpdateJobPosting, useCloseJobPosting } from "@/hooks/use-recruitment";
import { useDepartments } from "@/hooks/use-departments";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_POSTING_STATUSES,
  JOB_POSTING_STATUS_LABELS,
  type EmploymentType,
  type JobPosting,
  type JobPostingStatus,
} from "@/lib/api/recruitment";

const NO_DEPARTMENT = "__none__";

interface JobPostingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobPosting?: JobPosting;
}

export function JobPostingFormDialog({ open, onOpenChange, jobPosting }: JobPostingFormDialogProps) {
  const isEdit = !!jobPosting;
  const currentUser = useAuthStore((s) => s.user);
  const { data: departments } = useDepartments();
  const { data: users } = useUsers();
  const createJobPosting = useCreateJobPosting();
  const updateJobPosting = useUpdateJobPosting();
  const closeJobPosting = useCloseJobPosting();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("FULL_TIME");
  const [status, setStatus] = useState<JobPostingStatus>("OPEN");
  const [hiringDepartmentId, setHiringDepartmentId] = useState<string>(NO_DEPARTMENT);
  const [ownerId, setOwnerId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role.name === "ADMIN";
  const assignableUsers = isAdmin
    ? users
    : users?.filter((u) => u.department?.id === currentUser?.department?.id);

  useEffect(() => {
    if (!open) return;
    setTitle(jobPosting?.title ?? "");
    setDescription(jobPosting?.description ?? "");
    setLocation(jobPosting?.location ?? "");
    setEmploymentType(jobPosting?.employmentType ?? "FULL_TIME");
    setStatus(jobPosting?.status ?? "OPEN");
    setHiringDepartmentId(jobPosting?.hiringDepartmentId ?? NO_DEPARTMENT);
    setOwnerId(jobPosting?.ownerId ?? currentUser?.id ?? "");
    setError(null);
  }, [open, jobPosting, currentUser]);

  const saving = createJobPosting.isPending || updateJobPosting.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      title,
      description: description || undefined,
      location: location || undefined,
      employmentType,
      status,
      hiringDepartmentId: hiringDepartmentId === NO_DEPARTMENT ? undefined : hiringDepartmentId,
      ownerId: ownerId || undefined,
    };
    try {
      if (isEdit && jobPosting) {
        await updateJobPosting.mutateAsync({ id: jobPosting.id, input });
      } else {
        await createJobPosting.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save job posting");
    }
  }

  async function handleClose() {
    if (!jobPosting) return;
    try {
      await closeJobPosting.mutateAsync(jobPosting.id);
      onOpenChange(false);
    } catch {
      setError("Could not close this posting");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit job posting" : "New job posting"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="posting-title">Title</Label>
            <Input id="posting-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="posting-desc">Description</Label>
            <Textarea
              id="posting-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="posting-location">Location</Label>
              <Input
                id="posting-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote, City, ..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Employment type</Label>
              <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as EmploymentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EMPLOYMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as JobPostingStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_POSTING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {JOB_POSTING_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hiring for department</Label>
              <Select value={hiringDepartmentId} onValueChange={setHiringDepartmentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>Unspecified</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Owner (recruiter)</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleClose}
                disabled={closeJobPosting.isPending || jobPosting?.status === "CLOSED"}
              >
                {closeJobPosting.isPending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                Close posting
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create posting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
