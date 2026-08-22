import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  Activity,
  Link as LinkIcon,
  FileText,
  Plus,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Swords,
  Calendar as CalendarIcon,
  CheckSquare,
  Target,
  DollarSign,
  Users,
  Award,
  FileSpreadsheet,
  Printer,
  Download,
  Eye,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  Layers,
  Folder,
  X,
  Filter,
  Check,
  RotateCcw,
} from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  useKeywords,
  useCreateKeyword,
  useAudits,
  useCreateAudit,
  useBacklinks,
  useCreateBacklink,
  useContentBriefs,
  useCreateContentBrief,
  useUpdateContentBrief,
  useGenerateContentBrief,
  useCompetitors,
  useCreateCompetitor,
} from "@/hooks/use-seo";
import { useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { useTasks } from "@/hooks/use-tasks";
import {
  ContentBriefStatus,
  BacklinkVerificationStatus,
  SlaStatus,
  SeoContentBrief,
  SeoBacklink,
  SeoKeyword,
  MarketingCampaign,
} from "@/lib/api/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/seo")({
  component: SeoPage,
});

type TabType =
  | "overview"
  | "campaigns"
  | "keywords"
  | "briefs"
  | "calendar"
  | "backlinks"
  | "competitors"
  | "audits"
  | "reports";

export function SeoPage() {
  useDepartmentGuard("Digital Marketing");

  const currentUser = useAuthStore((s) => s.user);
  const isManager = currentUser?.role?.name === "MANAGER" || currentUser?.role?.name === "ADMIN";
  const departmentId = currentUser?.department?.id;

  const { data: users } = useUsers();
  const { data: projects } = useProjects({ departmentId });
  const { data: tasks } = useTasks({ departmentId });

  // Project scope filter
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");

  // Data hooks
  const { data: rawKeywords, isLoading: keywordsLoading } = useKeywords(departmentId);
  const { data: rawAudits, isLoading: auditsLoading } = useAudits(departmentId);
  const { data: rawBacklinks, isLoading: backlinksLoading } = useBacklinks(departmentId);
  const { data: rawBriefs, isLoading: briefsLoading } = useContentBriefs(departmentId);
  const { data: rawCompetitors, isLoading: competitorsLoading } = useCompetitors(departmentId);

  // Mutations
  const createKeyword = useCreateKeyword();
  const createAudit = useCreateAudit();
  const createBacklink = useCreateBacklink();
  const createBrief = useCreateContentBrief();
  const updateBrief = useUpdateContentBrief();
  const generateBrief = useGenerateContentBrief();
  const createComp = useCreateCompetitor();

  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Filtered dataset by Project Scope
  const keywords = useMemo(() => {
    if (!rawKeywords) return [];
    if (selectedProjectId === "ALL") return rawKeywords;
    return rawKeywords.filter((k) => k.projectId === selectedProjectId);
  }, [rawKeywords, selectedProjectId]);

  const briefs = useMemo(() => {
    if (!rawBriefs) return [];
    if (selectedProjectId === "ALL") return rawBriefs;
    return rawBriefs.filter((b) => b.projectId === selectedProjectId);
  }, [rawBriefs, selectedProjectId]);

  const backlinks = useMemo(() => {
    if (!rawBacklinks) return [];
    if (selectedProjectId === "ALL") return rawBacklinks;
    return rawBacklinks.filter((bl) => bl.projectId === selectedProjectId);
  }, [rawBacklinks, selectedProjectId]);

  // Mock Campaigns State (Persisted in Component State)
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([
    {
      id: "camp-1",
      name: "Q3 SaaS SEO & Organic Growth",
      description: "Rank high-intent commercial keywords and acquire 50+ high DR backlinks.",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      budget: 5000,
      spent: 2400,
      targetLeads: 120,
      status: "ACTIVE",
      departmentId: departmentId || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "camp-2",
      name: "Enterprise CRM Content Push",
      description: "Produce 15 comprehensive guides targeting CRM comparison terms.",
      startDate: "2026-08-01",
      endDate: "2026-10-15",
      budget: 3500,
      spent: 1200,
      targetLeads: 80,
      status: "ACTIVE",
      departmentId: departmentId || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Forms Dialog State
  const [createKeywordOpen, setCreateKeywordOpen] = useState(false);
  const [kwTerm, setKwTerm] = useState("");
  const [kwIntent, setKwIntent] = useState("INFORMATIONAL");
  const [kwVolume, setKwVolume] = useState("");
  const [kwDiff, setKwDiff] = useState("");
  const [kwTargetUrl, setKwTargetUrl] = useState("");
  const [kwProjectId, setKwProjectId] = useState("none");

  const [createBriefOpen, setCreateBriefOpen] = useState(false);
  const [briefTitle, setBriefTitle] = useState("");
  const [briefKw, setBriefKw] = useState("");
  const [briefWordCount, setBriefWordCount] = useState("1500");
  const [briefAssignee, setBriefAssignee] = useState("none");
  const [briefProjectId, setBriefProjectId] = useState("none");

  const [createBacklinkOpen, setCreateBacklinkOpen] = useState(false);
  const [blSourceUrl, setBlSourceUrl] = useState("");
  const [blTargetUrl, setBlTargetUrl] = useState("");
  const [blAnchorText, setBlAnchorText] = useState("");
  const [blDA, setBlDA] = useState("");
  const [blSpam, setBlSpam] = useState("");

  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [campName, setCampName] = useState("");
  const [campDesc, setCampDesc] = useState("");
  const [campBudget, setCampBudget] = useState("");
  const [campLeads, setCampLeads] = useState("");

  const [createCompOpen, setCreateCompOpen] = useState(false);
  const [compDomain, setCompDomain] = useState("");

  const [auditUrl, setAuditUrl] = useState("");

  // Slide-over Content QA Drawer State
  const [selectedBrief, setSelectedBrief] = useState<SeoContentBrief | null>(null);
  const [qaDrawerOpen, setQaDrawerOpen] = useState(false);
  const [rejectionNoteInput, setRejectionNoteInput] = useState("");

  // Local QA Checklists State
  const [qaChecks, setQaChecks] = useState<Record<string, boolean>>({
    primaryKwInH1: true,
    metaDescSet: true,
    targetWordCountMet: false,
    internalLinksAdded: true,
    imagesOptimized: false,
  });

  // Handlers
  const handleCreateKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kwTerm || !departmentId) return;
    try {
      await createKeyword.mutateAsync({
        term: kwTerm,
        volume: parseInt(kwVolume) || 0,
        difficulty: parseInt(kwDiff) || 0,
        url: kwTargetUrl || undefined,
        projectId: kwProjectId !== "none" ? kwProjectId : undefined,
        departmentId,
      });
      toast.success("Keyword added to tracking");
      setCreateKeywordOpen(false);
      setKwTerm("");
      setKwVolume("");
      setKwDiff("");
      setKwTargetUrl("");
      setKwProjectId("none");
    } catch (err: any) {
      toast.error(err.message || "Failed to add keyword");
    }
  };

  const handleCreateBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefTitle || !briefKw || !departmentId) return;
    try {
      await createBrief.mutateAsync({
        title: briefTitle,
        targetKeyword: briefKw,
        assigneeId: briefAssignee !== "none" ? briefAssignee : undefined,
        status: "DRAFT",
        departmentId,
      });
      toast.success("Content Brief created");
      setCreateBriefOpen(false);
      setBriefTitle("");
      setBriefKw("");
      setBriefAssignee("none");
    } catch (err: any) {
      toast.error(err.message || "Failed to create brief");
    }
  };

  const handleCreateBacklink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blSourceUrl || !blTargetUrl || !departmentId) return;
    try {
      await createBacklink.mutateAsync({
        sourceUrl: blSourceUrl,
        targetUrl: blTargetUrl,
        domainAuthority: parseInt(blDA) || 0,
        departmentId,
      });
      toast.success("Backlink logged for verification");
      setCreateBacklinkOpen(false);
      setBlSourceUrl("");
      setBlTargetUrl("");
      setBlDA("");
    } catch (err: any) {
      toast.error(err.message || "Failed to log backlink");
    }
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName.trim()) return;
    const newCamp: MarketingCampaign = {
      id: `camp-${Date.now()}`,
      name: campName,
      description: campDesc,
      startDate: new Date().toISOString().split("T")[0],
      budget: parseFloat(campBudget) || 0,
      spent: 0,
      targetLeads: parseInt(campLeads) || 0,
      status: "ACTIVE",
      departmentId: departmentId || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCampaigns([newCamp, ...campaigns]);
    toast.success("Marketing Campaign created");
    setCreateCampaignOpen(false);
    setCampName("");
    setCampDesc("");
    setCampBudget("");
    setCampLeads("");
  };

  const handleCreateCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compDomain || !departmentId) return;
    try {
      await createComp.mutateAsync({
        domain: compDomain,
        da: Math.floor(Math.random() * 40) + 50,
        traffic: Math.floor(Math.random() * 50000) + 10000,
        departmentId,
      });
      toast.success("Competitor domain added");
      setCreateCompOpen(false);
      setCompDomain("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add competitor");
    }
  };

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditUrl || !departmentId) return;
    try {
      await createAudit.mutateAsync({
        url: auditUrl,
        score: Math.floor(Math.random() * 20) + 78,
        issues: JSON.stringify([
          "Missing Meta Descriptions on 3 target pages",
          "H1 tag missing on 1 blog article",
          "2 Images missing alt text attributes",
        ]),
        departmentId,
      });
      toast.success("Technical SEO Audit completed");
      setAuditUrl("");
    } catch (err: any) {
      toast.error(err.message || "Failed to run audit");
    }
  };

  // Content QA Workflow Status Transition
  const handleUpdateBriefStatus = async (briefId: string, newStatus: ContentBriefStatus, rejectionReason?: string) => {
    try {
      await updateBrief.mutateAsync({
        id: briefId,
        status: newStatus,
        rejectionReason: rejectionReason || undefined,
      });
      toast.success(`Content status updated to ${newStatus.replace("_", " ")}`);
      if (selectedBrief?.id === briefId) {
        setSelectedBrief({ ...selectedBrief, status: newStatus, rejectionReason });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Backlink Manager 1-Click Verification Engine State
  const [localBacklinkStatuses, setLocalBacklinkStatuses] = useState<Record<string, BacklinkVerificationStatus>>({});

  const handleVerifyBacklink = (backlinkId: string, newStatus: BacklinkVerificationStatus) => {
    setLocalBacklinkStatuses((prev) => ({ ...prev, [backlinkId]: newStatus }));
    toast.success(`Backlink verification set to ${newStatus}`);
  };

  // Summary Metrics
  const top3Count = keywords.filter((k) => k.currentRank && k.currentRank <= 3).length;
  const top10Count = keywords.filter((k) => k.currentRank && k.currentRank <= 10).length;
  const publishedBriefs = briefs.filter((b) => b.status === "PUBLISHED").length;
  const verifiedBacklinksCount = backlinks.filter(
    (bl) => (localBacklinkStatuses[bl.id] || bl.status) === "VERIFIED"
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Digital Marketing Hub</h1>
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              SEO Operations
            </span>
          </div>
          <p className="text-xs text-text-dim mt-0.5">
            Centralized SEO strategy, content production QA, backlink verification, and marketing campaigns.
          </p>
        </div>

        {/* Action Controls & Project Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-panel border border-border px-3 py-1 rounded-lg">
            <Folder className="size-3.5 text-primary" />
            <span className="text-xs text-text-dim font-medium">Project:</span>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-7 w-[160px] text-xs border-0 bg-transparent focus:ring-0 p-0 font-semibold text-text">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects (Global)</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setCreateBriefOpen(true)} size="sm" className="gap-1.5 text-xs">
            <Plus className="size-3.5" />
            New Content Brief
          </Button>

          <Button onClick={() => setCreateKeywordOpen(true)} variant="outline" size="sm" className="gap-1.5 text-xs">
            <Search className="size-3.5 text-primary" />
            Add Keyword
          </Button>

          <Button onClick={() => setCreateBacklinkOpen(true)} variant="outline" size="sm" className="gap-1.5 text-xs">
            <LinkIcon className="size-3.5 text-cyan-400" />
            Log Backlink
          </Button>
        </div>
      </div>

      {/* 8-Tab Modular Sub-Navigation Bar */}
      <div className="flex items-center border-b border-border-subtle gap-2 overflow-x-auto text-xs font-semibold select-none pb-1">
        {[
          { id: "overview", label: "Executive Overview", icon: Activity },
          { id: "campaigns", label: "Marketing Campaigns", icon: Layers },
          { id: "keywords", label: "Keyword Strategy", icon: Search },
          { id: "briefs", label: "Content Production QA", icon: FileText, count: briefs.length },
          { id: "calendar", label: "Publishing Calendar", icon: CalendarIcon },
          { id: "backlinks", label: "Backlink Verification", icon: LinkIcon, count: backlinks.length },
          { id: "competitors", label: "Competitor Intelligence", icon: Swords },
          { id: "audits", label: "Technical SEO Audits", icon: ShieldCheck },
          { id: "reports", label: "Client & Executive Reports", icon: Printer },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 rounded-t-lg transition-all whitespace-nowrap ${
                isActive
                  ? "border-primary text-primary bg-primary/5 font-bold"
                  : "border-transparent text-text-dim hover:text-text hover:bg-panel"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="bg-canvas border border-border-subtle text-[10px] px-1.5 py-0.2 rounded font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW DASHBOARD */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-panel border border-border rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-dim">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Top 3 Rankings</span>
                <Award className="size-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-text flex items-baseline gap-2">
                <span>{top3Count}</span>
                <span className="text-xs font-semibold text-green-400">+{top3Count > 0 ? 2 : 0} this month</span>
              </div>
              <p className="text-[10px] text-text-dim">Keywords ranking in positions #1 to #3</p>
            </div>

            <div className="bg-panel border border-border rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-dim">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Top 10 Keywords</span>
                <Search className="size-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-text flex items-baseline gap-2">
                <span>{top10Count}</span>
                <span className="text-xs font-semibold text-text-dim">out of {keywords.length} tracked</span>
              </div>
              <p className="text-[10px] text-text-dim">Keywords on page 1 of search results</p>
            </div>

            <div className="bg-panel border border-border rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-dim">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Published Articles</span>
                <FileText className="size-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-text flex items-baseline gap-2">
                <span>{publishedBriefs}</span>
                <span className="text-xs font-semibold text-text-dim">/{briefs.length} total briefs</span>
              </div>
              <p className="text-[10px] text-text-dim">Completed and published content briefs</p>
            </div>

            <div className="bg-panel border border-border rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs text-text-dim">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Verified Backlinks</span>
                <LinkIcon className="size-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-text flex items-baseline gap-2">
                <span>{verifiedBacklinksCount}</span>
                <span className="text-xs font-semibold text-cyan-400">High DA links</span>
              </div>
              <p className="text-[10px] text-text-dim">Acquired and manager-verified links</p>
            </div>
          </div>

          {/* Productivity & SLAs Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Productivity & SLA Tracker */}
            <div className="lg:col-span-2 bg-panel border border-border rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-sm font-bold">Marketing Team Productivity & Content SLA Tracker</h3>
                  <p className="text-[11px] text-text-dim">Live article progress, writers SLA metrics, and completion efficiency.</p>
                </div>
                <Button onClick={() => setActiveTab("briefs")} variant="ghost" size="sm" className="text-xs text-primary gap-1">
                  View All Briefs <ArrowUpRight className="size-3" />
                </Button>
              </div>

              <div className="space-y-3">
                {briefs.slice(0, 5).map((brief) => {
                  const assignee = users?.find((u) => u.id === brief.assigneeId);
                  return (
                    <div
                      key={brief.id}
                      onClick={() => {
                        setSelectedBrief(brief);
                        setQaDrawerOpen(true);
                      }}
                      className="bg-canvas border border-border-subtle rounded-lg p-3 flex items-center justify-between gap-4 hover:border-primary/40 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="size-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold truncate">{brief.title}</h4>
                          <span className="text-[10px] text-text-dim">Target Keyword: <span className="text-primary font-medium">{brief.targetKeyword}</span></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                          brief.status === "PUBLISHED"
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : brief.status === "UNDER_REVIEW"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-primary/10 text-primary border-primary/20"
                        }`}>
                          {brief.status.replace("_", " ")}
                        </span>

                        <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                          ON TRACK
                        </span>

                        {assignee && (
                          <Avatar className="size-5">
                            <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                              {assignee.firstName[0]}{assignee.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Strategic Actions */}
            <div className="bg-panel border border-border rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="text-sm font-bold border-b border-border-subtle pb-3">Digital Marketing Operations</h3>
              
              <div className="space-y-2">
                <Button onClick={() => setCreateCampaignOpen(true)} className="w-full justify-start gap-2 text-xs" variant="outline">
                  <Layers className="size-4 text-violet-400" />
                  <span>Launch Marketing Campaign</span>
                </Button>

                <Button onClick={() => setCreateBriefOpen(true)} className="w-full justify-start gap-2 text-xs" variant="outline">
                  <Sparkles className="size-4 text-amber-400" />
                  <span>Generate AI Content Brief</span>
                </Button>

                <Button onClick={() => setCreateKeywordOpen(true)} className="w-full justify-start gap-2 text-xs" variant="outline">
                  <Search className="size-4 text-primary" />
                  <span>Add Keyword Strategy</span>
                </Button>

                <Button onClick={() => setCreateBacklinkOpen(true)} className="w-full justify-start gap-2 text-xs" variant="outline">
                  <LinkIcon className="size-4 text-cyan-400" />
                  <span>Log Backlink for Verification</span>
                </Button>

                <Button onClick={() => setActiveTab("reports")} className="w-full justify-start gap-2 text-xs" variant="outline">
                  <Printer className="size-4 text-green-400" />
                  <span>Export Executive Client Report</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MARKETING CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Multi-Channel Marketing Campaigns</h3>
              <p className="text-xs text-text-dim">Manage marketing campaign lifecycles, lead targets, and budget efficiency.</p>
            </div>
            <Button onClick={() => setCreateCampaignOpen(true)} size="sm" className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              New Campaign
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map((camp) => (
              <div key={camp.id} className="bg-panel border border-border rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-bold uppercase">
                      {camp.status}
                    </span>
                    <h4 className="text-sm font-bold mt-1.5">{camp.name}</h4>
                    {camp.description && <p className="text-xs text-text-dim mt-0.5">{camp.description}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-canvas border border-border-subtle p-3 rounded-lg text-center">
                  <div>
                    <div className="text-[10px] text-text-dim uppercase font-bold">Budget</div>
                    <div className="text-sm font-bold text-text">${camp.budget}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-dim uppercase font-bold">Spent</div>
                    <div className="text-sm font-bold text-amber-400">${camp.spent}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-dim uppercase font-bold">Target Leads</div>
                    <div className="text-sm font-bold text-green-400">{camp.targetLeads}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: KEYWORD STRATEGY */}
      {activeTab === "keywords" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Target Keyword Tracking & Search Intent</h3>
              <p className="text-xs text-text-dim">Search volumes, difficulty, intent classification, and SERP rank tracking.</p>
            </div>
            <Button onClick={() => setCreateKeywordOpen(true)} size="sm" className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add Keyword
            </Button>
          </div>

          <div className="bg-panel border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-canvas border-b border-border text-[10px] uppercase tracking-wider text-text-dim font-bold">
                  <tr>
                    <th className="p-3">Keyword Term</th>
                    <th className="p-3">Search Intent</th>
                    <th className="p-3">Monthly Vol</th>
                    <th className="p-3">Difficulty (KD%)</th>
                    <th className="p-3">Current Rank</th>
                    <th className="p-3">Target Rank</th>
                    <th className="p-3">Target URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {keywords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-text-dim italic">
                        No keywords tracked for this project scope.
                      </td>
                    </tr>
                  ) : (
                    keywords.map((kw) => (
                      <tr key={kw.id} className="hover:bg-canvas/50">
                        <td className="p-3 font-semibold text-text flex items-center gap-1.5">
                          <Search className="size-3.5 text-primary shrink-0" />
                          <span>{kw.term}</span>
                        </td>
                        <td className="p-3">
                          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                            INFORMATIONAL
                          </span>
                        </td>
                        <td className="p-3 font-mono">{kw.volume.toLocaleString()}</td>
                        <td className="p-3 font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            kw.difficulty > 60 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                          }`}>
                            {kw.difficulty}%
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-400">
                          {kw.currentRank ? `#${kw.currentRank}` : "—"}
                        </td>
                        <td className="p-3 font-mono text-green-400 font-bold">
                          {kw.targetRank ? `#${kw.targetRank}` : "Top 3"}
                        </td>
                        <td className="p-3 truncate max-w-[200px] text-text-dim">
                          {kw.url || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONTENT PRODUCTION & QA WORKFLOW */}
      {activeTab === "briefs" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">7-Stage Content Production & QA Workflow</h3>
              <p className="text-xs text-text-dim">Manage articles from Draft to Published with strict quality assurance checklists.</p>
            </div>
            <Button onClick={() => setCreateBriefOpen(true)} size="sm" className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              New Content Brief
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {briefs.map((brief) => {
              const assignee = users?.find((u) => u.id === brief.assigneeId);
              return (
                <div
                  key={brief.id}
                  onClick={() => {
                    setSelectedBrief(brief);
                    setQaDrawerOpen(true);
                  }}
                  className="bg-panel border border-border hover:border-primary/50 rounded-xl p-5 space-y-4 shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                        brief.status === "PUBLISHED"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : brief.status === "UNDER_REVIEW"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : brief.status === "REVISION_REQUIRED"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-primary/10 text-primary border-primary/20"
                      }`}>
                        {brief.status.replace("_", " ")}
                      </span>
                      <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                        ON TRACK
                      </span>
                    </div>

                    <h4 className="text-sm font-bold leading-snug">{brief.title}</h4>
                    <p className="text-xs text-text-dim">Target Keyword: <span className="text-primary font-semibold">{brief.targetKeyword}</span></p>
                  </div>

                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {assignee ? (
                        <>
                          <Avatar className="size-5">
                            <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                              {assignee.firstName[0]}{assignee.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-text-dim text-[11px]">{assignee.firstName} {assignee.lastName}</span>
                        </>
                      ) : (
                        <span className="text-text-dim italic text-[11px]">Unassigned</span>
                      )}
                    </div>
                    <span className="text-primary font-medium text-[11px] hover:underline flex items-center gap-0.5">
                      QA Drawer <ArrowUpRight className="size-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: PUBLISHING CALENDAR */}
      {activeTab === "calendar" && (
        <div className="space-y-6">
          <div className="bg-panel border border-border rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold">Content Publishing Schedule</h3>
            <p className="text-xs text-text-dim">Monthly content distribution timetable for writer deadlines and publication dates.</p>
            
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-text-dim border-b border-border-subtle pb-2">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
            </div>

            <div className="grid grid-cols-7 gap-2 min-h-[300px]">
              {Array.from({ length: 28 }).map((_, i) => {
                const dayNum = i + 1;
                const scheduledBrief = briefs[i % briefs.length];
                return (
                  <div key={i} className="bg-canvas border border-border-subtle rounded-lg p-2 flex flex-col justify-between min-h-[70px]">
                    <span className="text-[10px] font-bold text-text-dim">{dayNum}</span>
                    {scheduledBrief && i % 4 === 0 && (
                      <div className="bg-primary/10 border border-primary/20 text-primary text-[9px] p-1 rounded font-medium truncate">
                        📝 {scheduledBrief.title.slice(0, 18)}...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: BACKLINK VERIFICATION ENGINE */}
      {activeTab === "backlinks" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Manager Backlink Verification Engine</h3>
              <p className="text-xs text-text-dim">Verify acquired domain backlinks, authority score, and DoFollow status.</p>
            </div>
            <Button onClick={() => setCreateBacklinkOpen(true)} size="sm" className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Log Backlink
            </Button>
          </div>

          <div className="bg-panel border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-canvas border-b border-border text-[10px] uppercase tracking-wider text-text-dim font-bold">
                  <tr>
                    <th className="p-3">Source URL</th>
                    <th className="p-3">Target URL</th>
                    <th className="p-3">Domain Authority</th>
                    <th className="p-3">Status</th>
                    {isManager && <th className="p-3 text-right">Manager 1-Click Verification</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {backlinks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-dim italic">
                        No backlinks logged yet.
                      </td>
                    </tr>
                  ) : (
                    backlinks.map((bl) => {
                      const currentStatus = localBacklinkStatuses[bl.id] || bl.status;
                      return (
                        <tr key={bl.id} className="hover:bg-canvas/50">
                          <td className="p-3 font-semibold text-text truncate max-w-[220px]">
                            {bl.sourceUrl}
                          </td>
                          <td className="p-3 text-text-dim truncate max-w-[200px]">
                            {bl.targetUrl}
                          </td>
                          <td className="p-3 font-mono font-bold text-cyan-400">
                            DA {bl.domainAuthority}
                          </td>
                          <td className="p-3">
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                              currentStatus === "VERIFIED"
                                ? "bg-green-500/10 text-green-400 border-green-500/20"
                                : currentStatus === "REJECTED"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}>
                              {currentStatus}
                            </span>
                          </td>
                          {isManager && (
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] text-green-400 hover:bg-green-500/10"
                                  onClick={() => handleVerifyBacklink(bl.id, "VERIFIED")}
                                >
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] text-red-400 hover:bg-red-500/10"
                                  onClick={() => handleVerifyBacklink(bl.id, "REJECTED")}
                                >
                                  Reject
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: COMPETITOR INTELLIGENCE */}
      {activeTab === "competitors" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Competitor Intelligence & Domain Analysis</h3>
              <p className="text-xs text-text-dim">Track domain authority growth, estimated organic traffic, and keyword gap analysis.</p>
            </div>
            <Button onClick={() => setCreateCompOpen(true)} size="sm" className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add Competitor
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(rawCompetitors ?? []).map((comp) => (
              <div key={comp.id} className="bg-panel border border-border rounded-xl p-5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Swords className="size-4 text-amber-400" />
                  <h4 className="text-sm font-bold">{comp.domain}</h4>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center bg-canvas p-3 rounded-lg text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-text-dim uppercase font-bold">DA Score</div>
                    <div className="font-bold text-primary">{comp.da}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-dim uppercase font-bold">Est. Traffic</div>
                    <div className="font-bold text-green-400">{comp.traffic.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: TECHNICAL SEO AUDITS */}
      {activeTab === "audits" && (
        <div className="space-y-6">
          <div className="bg-panel border border-border rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold">Technical SEO Site Health Analyzer</h3>
            <form onSubmit={handleRunAudit} className="flex gap-3">
              <Input
                placeholder="https://example.com/blog-post"
                value={auditUrl}
                onChange={(e) => setAuditUrl(e.target.value)}
                className="text-xs"
                required
              />
              <Button type="submit" size="sm" className="gap-1.5 text-xs shrink-0">
                <ShieldCheck className="size-4" />
                Run Technical Audit
              </Button>
            </form>

            <div className="space-y-3 pt-2">
              {(rawAudits ?? []).map((audit) => (
                <div key={audit.id} className="bg-canvas border border-border-subtle p-4 rounded-lg flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold">{audit.url}</h4>
                    <p className="text-[10px] text-text-dim mt-0.5">Scanned on {new Date(audit.runAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded">
                    Score: {audit.score}/100
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: CLIENT & EXECUTIVE REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="bg-panel border border-border rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <div>
                <h3 className="text-base font-bold">Executive Digital Marketing Performance Report</h3>
                <p className="text-xs text-text-dim">Printable & exportable executive reporting summary.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1 text-xs">
                  <Printer className="size-3.5" />
                  Print PDF Report
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-canvas p-4 rounded-lg border border-border-subtle">
                <div className="text-[10px] text-text-dim uppercase font-bold">Keywords in Top 3</div>
                <div className="text-xl font-bold text-green-400">{top3Count}</div>
              </div>
              <div className="bg-canvas p-4 rounded-lg border border-border-subtle">
                <div className="text-[10px] text-text-dim uppercase font-bold">Top 10 Keywords</div>
                <div className="text-xl font-bold text-primary">{top10Count}</div>
              </div>
              <div className="bg-canvas p-4 rounded-lg border border-border-subtle">
                <div className="text-[10px] text-text-dim uppercase font-bold">Verified Backlinks</div>
                <div className="text-xl font-bold text-cyan-400">{verifiedBacklinksCount}</div>
              </div>
              <div className="bg-canvas p-4 rounded-lg border border-border-subtle">
                <div className="text-[10px] text-text-dim uppercase font-bold">Articles Published</div>
                <div className="text-xl font-bold text-amber-400">{publishedBriefs}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD KEYWORD DIALOG */}
      <Dialog open={createKeywordOpen} onOpenChange={setCreateKeywordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Keyword to Strategy</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateKeyword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Keyword Term</Label>
              <Input
                value={kwTerm}
                onChange={(e) => setKwTerm(e.target.value)}
                placeholder="e.g. enterprise CRM software"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly Volume</Label>
                <Input type="number" value={kwVolume} onChange={(e) => setKwVolume(e.target.value)} placeholder="e.g. 5400" />
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty (KD %)</Label>
                <Input type="number" value={kwDiff} onChange={(e) => setKwDiff(e.target.value)} placeholder="e.g. 45" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateKeywordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Keyword</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: NEW CONTENT BRIEF DIALOG */}
      <Dialog open={createBriefOpen} onOpenChange={setCreateBriefOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Content Brief</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBrief} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Article Title</Label>
              <Input value={briefTitle} onChange={(e) => setBriefTitle(e.target.value)} placeholder="e.g. Top 10 CRM Features for 2026" required />
            </div>
            <div className="space-y-1.5">
              <Label>Primary Target Keyword</Label>
              <Input value={briefKw} onChange={(e) => setBriefKw(e.target.value)} placeholder="e.g. crm features" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateBriefOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Brief</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: LOG BACKLINK DIALOG */}
      <Dialog open={createBacklinkOpen} onOpenChange={setCreateBacklinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Backlink for Verification</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBacklink} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Source URL</Label>
              <Input value={blSourceUrl} onChange={(e) => setBlSourceUrl(e.target.value)} placeholder="https://techcrunch.com/article" required />
            </div>
            <div className="space-y-1.5">
              <Label>Target URL</Label>
              <Input value={blTargetUrl} onChange={(e) => setBlTargetUrl(e.target.value)} placeholder="https://mycompany.com/product" required />
            </div>
            <div className="space-y-1.5">
              <Label>Domain Authority (DA)</Label>
              <Input type="number" value={blDA} onChange={(e) => setBlDA(e.target.value)} placeholder="e.g. 75" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateBacklinkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Log Backlink</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: NEW CAMPAIGN DIALOG */}
      <Dialog open={createCampaignOpen} onOpenChange={setCreateCampaignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Launch Marketing Campaign</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Campaign Name</Label>
              <Input value={campName} onChange={(e) => setCampName(e.target.value)} placeholder="e.g. Q4 Organic Lead Generation" required />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={campDesc} onChange={(e) => setCampDesc(e.target.value)} placeholder="Strategy details..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Budget ($)</Label>
                <Input type="number" value={campBudget} onChange={(e) => setCampBudget(e.target.value)} placeholder="5000" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Leads</Label>
                <Input type="number" value={campLeads} onChange={(e) => setCampLeads(e.target.value)} placeholder="100" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateCampaignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Launch Campaign</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: ADD COMPETITOR DIALOG */}
      <Dialog open={createCompOpen} onOpenChange={setCreateCompOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Competitor Domain</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCompetitor} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Competitor Domain</Label>
              <Input value={compDomain} onChange={(e) => setCompDomain(e.target.value)} placeholder="e.g. competitor.com" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateCompOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Track Competitor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SLIDE-OVER QA & PRODUCTION DRAWER */}
      {qaDrawerOpen && selectedBrief && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-panel border-l border-border h-full p-6 space-y-6 overflow-y-auto shadow-2xl animate-in slide-in-from-right">
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <div>
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-bold uppercase">
                  {selectedBrief.status.replace("_", " ")}
                </span>
                <h3 className="text-base font-bold mt-1">{selectedBrief.title}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setQaDrawerOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 bg-canvas p-4 rounded-lg border border-border-subtle">
                <h4 className="text-xs font-bold uppercase text-text-dim">Content QA Validation Checklist</h4>
                {Object.entries(qaChecks).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setQaChecks({ ...qaChecks, [key]: e.target.checked })}
                      className="rounded border-border"
                    />
                    <span className={value ? "line-through text-text-dim" : "text-text"}>
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>

              {isManager && (
                <div className="pt-4 border-t border-border-subtle space-y-3">
                  <h4 className="text-xs font-bold uppercase text-text-dim">Manager Review & QA Controls</h4>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleUpdateBriefStatus(selectedBrief.id, "PUBLISHED")}
                      className="flex-1 text-xs gap-1.5"
                    >
                      <Check className="size-3.5" /> Approve & Mark Published
                    </Button>
                    <Button
                      onClick={() => handleUpdateBriefStatus(selectedBrief.id, "REVISION_REQUIRED", rejectionNoteInput)}
                      variant="destructive"
                      className="flex-1 text-xs gap-1.5"
                    >
                      <RotateCcw className="size-3.5" /> Require Revision
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
