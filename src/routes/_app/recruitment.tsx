import { createFileRoute } from "@tanstack/react-router";
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
import {
  Briefcase,
  Plus,
  Loader2,
  CalendarClock,
  FileText,
  Clock,
  TrendingUp,
  CheckCircle2,
  Percent,
  Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobPostingFormDialog } from "@/components/job-posting-form-dialog";
import { CandidateFormDialog } from "@/components/candidate-form-dialog";
import { InterviewFormDialog } from "@/components/interview-form-dialog";
import { OfferFormDialog } from "@/components/offer-form-dialog";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import {
  useJobPostings,
  useCandidates,
  useUpdateCandidate,
  useInterviews,
  useOffers,
  useRecruitmentAnalyticsSummary,
} from "@/hooks/use-recruitment";
import {
  CANDIDATE_STAGES,
  CANDIDATE_STAGE_LABELS,
  JOB_POSTING_STATUS_LABELS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  OFFER_STATUS_LABELS,
  type Candidate,
  type CandidateStage,
  type JobPosting,
} from "@/lib/api/recruitment";

export const Route = createFileRoute("/_app/recruitment")({
  component: RecruitmentPage,
});

const ALL = "__all__";

function RecruitmentPage() {
  useDepartmentGuard("Recruitment");

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Briefcase className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recruitment</h1>
          <p className="text-sm text-text-dim mt-1">Job postings, candidate pipeline, interviews, and offers.</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="postings">Job Postings</TabsTrigger>
          <TabsTrigger value="pipeline">Candidates</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="postings" className="mt-4">
          <JobPostingsTab />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab />
        </TabsContent>
        <TabsContent value="interviews" className="mt-4">
          <InterviewsTab />
        </TabsContent>
        <TabsContent value="offers" className="mt-4">
          <OffersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="bg-panel border-border-subtle rounded-xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-medium uppercase tracking-widest text-text-dim">{title}</CardTitle>
        <Icon className="size-4 text-text-dim" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="text-[9px] text-text-dim mt-1.5">{description}</p>
      </CardContent>
    </Card>
  );
}

function DashboardTab() {
  const { data: summary, isLoading } = useRecruitmentAnalyticsSummary();

  if (isLoading || !summary) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-text-dim" />
      </div>
    );
  }

  const totalInFunnel = CANDIDATE_STAGES.reduce((sum, s) => sum + summary.stageCounts[s], 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Open Positions"
          value={String(summary.openPositions)}
          description="Job postings currently open"
          icon={Briefcase}
        />
        <StatCard
          title="Active Candidates"
          value={String(summary.totalCandidates)}
          description="Across all postings"
          icon={Users2}
        />
        <StatCard
          title="Hires This Month"
          value={String(summary.hiresThisMonth)}
          description="Candidates hired since the 1st"
          icon={CheckCircle2}
        />
        <StatCard
          title="Avg Time to Hire"
          value={summary.avgTimeToHireDays !== null ? `${summary.avgTimeToHireDays}d` : "—"}
          description="Application to hire, average"
          icon={Clock}
        />
        <StatCard
          title="Offer Acceptance"
          value={summary.offerAcceptanceRate !== null ? `${summary.offerAcceptanceRate}%` : "—"}
          description="Of offers responded to"
          icon={Percent}
        />
        <StatCard
          title="Upcoming Interviews"
          value={String(summary.upcomingInterviews)}
          description="Scheduled, not yet happened"
          icon={CalendarClock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-panel border-border-subtle rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Pipeline Funnel</CardTitle>
            <CardDescription className="text-[10px]">Candidates by current stage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {CANDIDATE_STAGES.map((stage) => {
              const count = summary.stageCounts[stage];
              const pct = totalInFunnel > 0 ? Math.round((count / totalInFunnel) * 100) : 0;
              return (
                <div key={stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{CANDIDATE_STAGE_LABELS[stage]}</span>
                    <span className="text-text-dim">{count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden border border-border-subtle">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-panel border-border-subtle rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Open Roles by Department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.openPositionsByDepartment.length === 0 ? (
              <p className="text-xs text-text-dim">No open positions.</p>
            ) : (
              summary.openPositionsByDepartment.map((d) => (
                <div key={d.departmentId ?? "unassigned"} className="flex items-center justify-between text-xs">
                  <span>{d.departmentName}</span>
                  <Badge variant="outline">{d.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function JobPostingsTab() {
  const { data: postings, isLoading } = useJobPostings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosting | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(posting: JobPosting) {
    setEditing(posting);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New Posting
        </Button>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Hiring for</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Candidates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && postings?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-text-dim py-8">
                  No job postings yet.
                </TableCell>
              </TableRow>
            )}
            {postings?.map((posting) => (
              <TableRow key={posting.id} className="cursor-pointer" onClick={() => openEdit(posting)}>
                <TableCell className="font-medium">{posting.title}</TableCell>
                <TableCell>
                  <Badge variant={posting.status === "OPEN" ? "default" : "outline"}>
                    {JOB_POSTING_STATUS_LABELS[posting.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-text-dim">{posting.location ?? "—"}</TableCell>
                <TableCell className="text-text-dim">{posting.hiringDepartment?.name ?? "—"}</TableCell>
                <TableCell className="text-text-dim">
                  {posting.owner.firstName} {posting.owner.lastName}
                </TableCell>
                <TableCell className="text-text-dim">{posting._count.candidates}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <JobPostingFormDialog open={dialogOpen} onOpenChange={setDialogOpen} jobPosting={editing} />
    </div>
  );
}

const STAGE_TONE: Record<CandidateStage, string> = {
  APPLIED: "text-text-dim",
  SCREENING: "text-info",
  INTERVIEW: "text-violet",
  OFFER: "text-warning",
  HIRED: "text-success",
  REJECTED: "text-destructive",
};

type Columns = Record<CandidateStage, Candidate[]>;

function emptyColumns(): Columns {
  return { APPLIED: [], SCREENING: [], INTERVIEW: [], OFFER: [], HIRED: [], REJECTED: [] };
}

function groupByStage(candidates: Candidate[]): Columns {
  const columns = emptyColumns();
  for (const c of candidates) {
    columns[c.stage].push(c);
  }
  for (const stage of CANDIDATE_STAGES) {
    columns[stage].sort((a, b) => a.position - b.position);
  }
  return columns;
}

function PipelineTab() {
  const { data: postings } = useJobPostings();
  const [jobPostingId, setJobPostingId] = useState<string>(ALL);
  const { data: candidates } = useCandidates({
    jobPostingId: jobPostingId === ALL ? undefined : jobPostingId,
  });
  const updateCandidate = useUpdateCandidate();

  const [columns, setColumns] = useState<Columns>(emptyColumns());
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);

  useEffect(() => {
    if (candidates) {
      setColumns(groupByStage(candidates));
    }
  }, [candidates]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function findColumnOf(id: string): CandidateStage | undefined {
    return CANDIDATE_STAGES.find((s) => columns[s].some((c) => c.id === id));
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const stage = findColumnOf(id);
    if (stage) {
      setActiveCandidate(columns[stage].find((c) => c.id === id) ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCandidate(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const sourceStage = findColumnOf(activeId);
    if (!sourceStage) return;

    const overId = String(over.id);
    const destStage = (CANDIDATE_STAGES as string[]).includes(overId)
      ? (overId as CandidateStage)
      : findColumnOf(overId);
    if (!destStage) return;

    setColumns((prev) => {
      const sourceList = [...prev[sourceStage]];
      const idx = sourceList.findIndex((c) => c.id === activeId);
      if (idx === -1) return prev;
      const [moved] = sourceList.splice(idx, 1);

      const destList = sourceStage === destStage ? sourceList : [...prev[destStage]];
      const overIndex = destList.findIndex((c) => c.id === overId);
      const insertAt = overIndex === -1 ? destList.length : overIndex;
      destList.splice(insertAt, 0, { ...moved, stage: destStage });

      updateCandidate.mutate({ id: activeId, input: { stage: destStage, position: insertAt } });

      return { ...prev, [sourceStage]: sourceList, [destStage]: destList };
    });
  }

  function openCreate() {
    setEditingCandidateId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingCandidateId(id);
    setDialogOpen(true);
  }

  const editingCandidate = useMemo(() => {
    if (!editingCandidateId || !candidates) return undefined;
    return candidates.find((c) => c.id === editingCandidateId);
  }, [editingCandidateId, candidates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={jobPostingId} onValueChange={setJobPostingId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Job posting" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All postings</SelectItem>
            {postings?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New Candidate
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {CANDIDATE_STAGES.map((stage) => (
            <PipelineColumn key={stage} stage={stage} candidates={columns[stage]} onClick={openEdit} />
          ))}
        </div>
        <DragOverlay>{activeCandidate && <CandidateCard candidate={activeCandidate} dragging />}</DragOverlay>
      </DndContext>

      <CandidateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        candidate={editingCandidate}
        defaultJobPostingId={jobPostingId === ALL ? undefined : jobPostingId}
      />
    </div>
  );
}

function PipelineColumn({
  stage,
  candidates,
  onClick,
}: {
  stage: CandidateStage;
  candidates: Candidate[];
  onClick: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className="bg-panel border border-border-subtle rounded-xl p-3 flex flex-col gap-2 min-w-[260px] shrink-0"
    >
      <div className="flex items-center justify-between px-1">
        <span className={`text-xs font-semibold ${STAGE_TONE[stage]}`}>{CANDIDATE_STAGE_LABELS[stage]}</span>
        <span className="text-[10px] text-text-dim">{candidates.length}</span>
      </div>
      <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[80px]">
          {candidates.map((candidate) => (
            <SortableCandidateCard key={candidate.id} candidate={candidate} onClick={() => onClick(candidate.id)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCandidateCard({ candidate, onClick }: { candidate: Candidate; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: candidate.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <CandidateCard candidate={candidate} />
    </div>
  );
}

function CandidateCard({ candidate, dragging }: { candidate: Candidate; dragging?: boolean }) {
  return (
    <div
      className={`bg-canvas/50 border border-border-subtle rounded-lg p-3 cursor-pointer hover:border-border transition-colors ${dragging ? "shadow-xl" : ""}`}
    >
      <p className="text-sm font-medium truncate">
        {candidate.firstName} {candidate.lastName}
      </p>
      <p className="text-xs text-text-dim mt-0.5 truncate">{candidate.jobPosting.title}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-text-dim truncate">{candidate.source ?? "—"}</span>
        <Avatar className="size-5 shrink-0">
          <AvatarFallback className="text-[9px]">
            {candidate.owner.firstName[0]}
            {candidate.owner.lastName[0]}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}

function InterviewsTab() {
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const { data: interviews, isLoading } = useInterviews({ upcoming: upcomingOnly || undefined });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = useMemo(() => interviews?.find((iv) => iv.id === editingId), [interviews, editingId]);

  function openCreate() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={upcomingOnly ? "upcoming" : "all"} onValueChange={(v) => setUpcomingOnly(v === "upcoming")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Schedule Interview
        </Button>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Interviewer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && interviews?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-text-dim py-8">
                  No interviews found.
                </TableCell>
              </TableRow>
            )}
            {interviews?.map((iv) => (
              <TableRow key={iv.id} className="cursor-pointer" onClick={() => openEdit(iv.id)}>
                <TableCell className="font-medium">
                  {iv.candidate.firstName} {iv.candidate.lastName}
                </TableCell>
                <TableCell className="text-text-dim">{INTERVIEW_TYPE_LABELS[iv.type]}</TableCell>
                <TableCell className="text-text-dim">{new Date(iv.scheduledAt).toLocaleString()}</TableCell>
                <TableCell className="text-text-dim">
                  {iv.interviewer ? `${iv.interviewer.firstName} ${iv.interviewer.lastName}` : "Unassigned"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{INTERVIEW_STATUS_LABELS[iv.status]}</Badge>
                </TableCell>
                <TableCell className="text-text-dim">{iv.rating ? `${iv.rating}/5` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InterviewFormDialog open={dialogOpen} onOpenChange={setDialogOpen} interview={editing} />
    </div>
  );
}

function OffersTab() {
  const { data: offers, isLoading } = useOffers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = useMemo(() => offers?.find((o) => o.id === editingId), [offers, editingId]);

  function openCreate() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New Offer
        </Button>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created by</TableHead>
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
            {!isLoading && offers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  No offers yet.
                </TableCell>
              </TableRow>
            )}
            {offers?.map((offer) => (
              <TableRow key={offer.id} className="cursor-pointer" onClick={() => openEdit(offer.id)}>
                <TableCell className="font-medium">
                  {offer.candidate.firstName} {offer.candidate.lastName}
                </TableCell>
                <TableCell className="text-text-dim">${offer.salary.toLocaleString()}</TableCell>
                <TableCell className="text-text-dim">
                  {offer.startDate ? new Date(offer.startDate).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{OFFER_STATUS_LABELS[offer.status]}</Badge>
                </TableCell>
                <TableCell className="text-text-dim">
                  {offer.createdBy.firstName} {offer.createdBy.lastName}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OfferFormDialog open={dialogOpen} onOpenChange={setDialogOpen} offer={editing} />
    </div>
  );
}
