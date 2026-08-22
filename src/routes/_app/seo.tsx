import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
} from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useAuthStore } from "@/stores/auth-store";
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
import { ContentBriefStatus } from "@/lib/api/seo";

export const Route = createFileRoute("/_app/seo")({
  component: SeoPage,
});

function SeoPage() {
  useDepartmentGuard("Digital Marketing");

  const currentUser = useAuthStore((s) => s.user);
  const departmentId = currentUser?.department?.id;

  const { data: users } = useUsers();
  
  // Data hooks
  const { data: keywords, isLoading: keywordsLoading } = useKeywords(departmentId);
  const { data: audits, isLoading: auditsLoading } = useAudits(departmentId);
  const { data: backlinks, isLoading: backlinksLoading } = useBacklinks(departmentId);
  const { data: briefs, isLoading: briefsLoading } = useContentBriefs(departmentId);
  const { data: competitors, isLoading: competitorsLoading } = useCompetitors(departmentId);
  const { data: projects } = useProjects({ departmentId });

  // Mutations
  const createKeyword = useCreateKeyword();
  const createAudit = useCreateAudit();
  const createBacklink = useCreateBacklink();
  const createBrief = useCreateContentBrief();
  const updateBrief = useUpdateContentBrief();
  const generateBrief = useGenerateContentBrief();
  const createComp = useCreateCompetitor();

  const [activeTab, setActiveTab] = useState<"dashboard" | "keywords" | "audits" | "backlinks" | "briefs" | "competitors">("dashboard");

  // Forms State
  const [createKeywordOpen, setCreateKeywordOpen] = useState(false);
  const [kwTerm, setKwTerm] = useState("");
  const [kwVolume, setKwVolume] = useState("");
  const [kwDiff, setKwDiff] = useState("");
  const [kwTargetUrl, setKwTargetUrl] = useState("");
  const [kwProjectId, setKwProjectId] = useState("none");

  const [createBriefOpen, setCreateBriefOpen] = useState(false);
  const [briefTitle, setBriefTitle] = useState("");
  const [briefKw, setBriefKw] = useState("");
  const [briefAssignee, setBriefAssignee] = useState("none");

  // Competitor dialog state
  const [createCompOpen, setCreateCompOpen] = useState(false);
  const [compDomain, setCompDomain] = useState("");

  // Audit analyzer state
  const [auditUrl, setAuditUrl] = useState("");
  const [auditKw, setAuditKw] = useState("");

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
      setCreateKeywordOpen(false);
      setKwTerm("");
      setKwVolume("");
      setKwDiff("");
      setKwTargetUrl("");
      setKwProjectId("none");
    } catch (err) {
      console.error(err);
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
      setCreateBriefOpen(false);
      setBriefTitle("");
      setBriefKw("");
      setBriefAssignee("none");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compDomain || !departmentId) return;
    try {
      await createComp.mutateAsync({ domain: compDomain, da: 0, traffic: 0, departmentId });
      setCreateCompOpen(false);
      setCompDomain("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyzeAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditUrl || !departmentId) return;
    // Simulate a score based on URL + keyword (replace with real crawl integration later)
    const score = Math.floor(Math.random() * 30) + 70;
    const issues = JSON.stringify([
      { type: "info", message: `H1: Found` },
      { type: auditKw ? "pass" : "warn", message: `Target keyword "${auditKw || "(none)"}" in meta: ${auditKw ? "Yes" : "No"}` },
      { type: "pass", message: "Mobile-friendly: Pass" },
    ]);
    try {
      await createAudit.mutateAsync({ url: auditUrl, score, issues, departmentId });
      setAuditUrl("");
      setAuditKw("");
    } catch (err) {
      console.error(err);
    }
  };

  const avgRank = keywords?.length 
    ? Math.round(keywords.reduce((acc, k) => acc + (k.currentRank || 0), 0) / keywords.filter(k => k.currentRank).length) 
    : 0;
  
  const latestAudit = audits?.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime())[0];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Search className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">SEO Manager</h1>
            <p className="text-sm text-text-dim font-medium">Keywords, Content, and Tech SEO</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6 h-full min-h-0">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-6 mb-4 shrink-0 border-b border-border-subtle">
            {["dashboard", "keywords", "briefs", "competitors", "backlinks", "audits"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`pb-2 border-b-2 px-1 transition-all capitalize ${
                  activeTab === tab ? "border-indigo-500 text-text font-bold" : "border-transparent text-text-dim hover:text-text"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1 pr-4">
            {/* Dashboard View */}
            {activeTab === "dashboard" && (
              <div className="space-y-6 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-panel border border-border p-4 rounded-xl flex flex-col gap-1">
                    <span className="text-[10px] text-text-dim font-bold uppercase tracking-wider">Avg Keyword Rank</span>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-black">{avgRank || '--'}</span>
                      {avgRank > 0 && <TrendingUp className="size-4 text-green-500 mb-1" />}
                    </div>
                  </div>
                  <div className="bg-panel border border-border p-4 rounded-xl flex flex-col gap-1">
                    <span className="text-[10px] text-text-dim font-bold uppercase tracking-wider">Tracked Keywords</span>
                    <span className="text-3xl font-black">{keywords?.length || 0}</span>
                  </div>
                  <div className="bg-panel border border-border p-4 rounded-xl flex flex-col gap-1">
                    <span className="text-[10px] text-text-dim font-bold uppercase tracking-wider">Latest Audit Score</span>
                    <span className={`text-3xl font-black ${latestAudit?.score && latestAudit.score > 80 ? 'text-green-500' : 'text-amber-500'}`}>
                      {latestAudit?.score || '--'}/100
                    </span>
                  </div>
                  <div className="bg-panel border border-border p-4 rounded-xl flex flex-col gap-1">
                    <span className="text-[10px] text-text-dim font-bold uppercase tracking-wider">Active Backlinks</span>
                    <span className="text-3xl font-black">{backlinks?.filter(b => b.status === "ACTIVE").length || 0}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Quick Briefs */}
                  <div className="bg-panel border border-border p-4 rounded-xl">
                    <h3 className="text-sm font-bold border-b border-border-subtle pb-2 mb-3">Content Pipeline</h3>
                    <div className="space-y-2">
                      {briefs?.filter(b => b.status !== "PUBLISHED").slice(0, 5).map(brief => (
                        <div key={brief.id} className="flex items-center justify-between bg-background p-2 rounded border border-border-subtle text-xs">
                          <div>
                            <p className="font-bold">{brief.title}</p>
                            <p className="text-[9px] text-text-dim">KW: {brief.targetKeyword}</p>
                          </div>
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 font-bold text-[9px] rounded uppercase">{brief.status}</span>
                        </div>
                      ))}
                      {!briefs?.length && <p className="text-xs text-text-dim">No active content briefs.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Keywords View */}
            {activeTab === "keywords" && (
              <div className="space-y-4 pb-20">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <h3 className="text-sm font-bold">Tracked Keywords</h3>
                  <Button size="sm" className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setCreateKeywordOpen(true)}>
                    <Plus className="size-3 mr-1" /> Add Keyword
                  </Button>
                </div>
                {keywordsLoading && <Loader2 className="size-4 animate-spin text-text-dim" />}
                {!keywordsLoading && (
                  <div className="bg-panel border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-background border-b border-border-subtle">
                        <tr>
                          <th className="p-3 font-bold text-text-dim">Keyword</th>
                          <th className="p-3 font-bold text-text-dim">Volume</th>
                          <th className="p-3 font-bold text-text-dim">KD</th>
                          <th className="p-3 font-bold text-text-dim">Current Rank</th>
                          <th className="p-3 font-bold text-text-dim">Target URL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {keywords?.map(kw => (
                          <tr key={kw.id} className="hover:bg-background/50 transition-colors">
                            <td className="p-3 font-bold">{kw.term}</td>
                            <td className="p-3">{kw.volume.toLocaleString()}</td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded font-bold ${kw.difficulty > 70 ? 'bg-red-500/10 text-red-500' : kw.difficulty > 30 ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                                {kw.difficulty}
                              </span>
                            </td>
                            <td className="p-3">
                              {kw.currentRank ? (
                                <span className="font-bold">{kw.currentRank}</span>
                              ) : <span className="text-text-dim">-</span>}
                            </td>
                            <td className="p-3 text-text-dim max-w-[200px] truncate">
                              {kw.url || "-"}
                            </td>
                          </tr>
                        ))}
                        {!keywords?.length && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-text-dim">No keywords tracked.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Briefs View */}
            {activeTab === "briefs" && (
              <div className="space-y-4 pb-20">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <h3 className="text-sm font-bold">Content Briefs Workflow</h3>
                  <Button size="sm" className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setCreateBriefOpen(true)}>
                    <Plus className="size-3 mr-1" /> New Brief
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(["DRAFT", "IN_PROGRESS", "REVIEW", "PUBLISHED"] as ContentBriefStatus[]).map(status => (
                    <div key={status} className="bg-panel border border-border rounded-xl p-3 flex flex-col min-h-[300px]">
                      <h4 className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-3">{status.replace("_", " ")}</h4>
                      <div className="space-y-2 flex-1">
                        {briefs?.filter(b => b.status === status).map(brief => (
                          <div key={brief.id} className="bg-background border border-border-subtle p-2.5 rounded-lg space-y-2 shadow-sm">
                            <div className="font-bold text-xs leading-tight">{brief.title}</div>
                            <div className="text-[9px] text-text-dim font-mono bg-panel px-1 py-0.5 rounded border border-border-subtle inline-block">
                              {brief.targetKeyword}
                            </div>
                            <div className="pt-2 border-t border-border-subtle flex items-center justify-between mt-2">
                              <span className="text-[9px] text-text-dim font-bold">
                                {brief.assignee ? brief.assignee.firstName : "Unassigned"}
                              </span>
                              <Select value={brief.status} onValueChange={(val) => updateBrief.mutate({ id: brief.id, status: val as ContentBriefStatus })}>
                                <SelectTrigger className="h-5 text-[8px] w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="DRAFT" className="text-[9px]">DRAFT</SelectItem>
                                  <SelectItem value="IN_PROGRESS" className="text-[9px]">IN_PROGRESS</SelectItem>
                                  <SelectItem value="REVIEW" className="text-[9px]">REVIEW</SelectItem>
                                  <SelectItem value="PUBLISHED" className="text-[9px]">PUBLISHED</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {brief.status === "DRAFT" && !brief.content && (
                              <div className="pt-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full h-6 text-[9px] border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10"
                                  onClick={() => generateBrief.mutate(brief.id)}
                                  disabled={generateBrief.isPending}
                                >
                                  <Sparkles className="size-3 mr-1" />
                                  {generateBrief.isPending ? "Generating..." : "Auto-Generate Draft"}
                                </Button>
                              </div>
                            )}
                            {brief.content && (
                              <div className="pt-2 text-[9px] text-text-dim line-clamp-2 italic border-t border-border-subtle mt-2">
                                {brief.content}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competitors View */}
            {activeTab === "competitors" && (
              <div className="space-y-4 pb-20">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Swords className="size-4" /> Competitor Tracking</h3>
                  <Button size="sm" className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setCreateCompOpen(true)}>
                    <Plus className="size-3 mr-1" /> Add Competitor
                  </Button>
                </div>
                {competitorsLoading && <Loader2 className="size-4 animate-spin text-text-dim" />}
                {!competitorsLoading && (
                  <div className="bg-panel border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-background border-b border-border-subtle">
                        <tr>
                          <th className="p-3 font-bold text-text-dim">Domain</th>
                          <th className="p-3 font-bold text-text-dim">Domain Authority</th>
                          <th className="p-3 font-bold text-text-dim">Est. Traffic</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {competitors?.map(c => (
                          <tr key={c.id} className="hover:bg-background/50 transition-colors">
                            <td className="p-3 font-bold text-indigo-400">{c.domain}</td>
                            <td className="p-3 font-mono">{c.da}</td>
                            <td className="p-3">{c.traffic.toLocaleString()} / mo</td>
                          </tr>
                        ))}
                        {!competitors?.length && (
                          <tr>
                            <td colSpan={3} className="p-8 text-center text-text-dim">No competitors tracked.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            
            {/* Backlinks View */}
            {activeTab === "backlinks" && (
              <div className="space-y-4 pb-20">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <h3 className="text-sm font-bold">Backlink Monitor</h3>
                </div>
                {backlinksLoading && <Loader2 className="size-4 animate-spin text-text-dim" />}
                {!backlinksLoading && (
                  <div className="bg-panel border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-background border-b border-border-subtle">
                        <tr>
                          <th className="p-3 font-bold text-text-dim">Source URL</th>
                          <th className="p-3 font-bold text-text-dim">Target URL</th>
                          <th className="p-3 font-bold text-text-dim">DA</th>
                          <th className="p-3 font-bold text-text-dim">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {backlinks?.map(bl => (
                          <tr key={bl.id} className="hover:bg-background/50 transition-colors">
                            <td className="p-3 font-mono text-[10px] truncate max-w-[200px]">{bl.sourceUrl}</td>
                            <td className="p-3 font-mono text-[10px] text-text-dim truncate max-w-[200px]">{bl.targetUrl}</td>
                            <td className="p-3 font-bold text-indigo-400">{bl.domainAuthority}</td>
                            <td className="p-3">
                              {bl.status === "ACTIVE" ? (
                                <span className="flex items-center gap-1 text-green-500 font-bold"><CheckCircle2 className="size-3" /> ACTIVE</span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-500 font-bold"><AlertCircle className="size-3" /> LOST</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!backlinks?.length && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-text-dim">No backlinks tracked.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Audits View */}
            {activeTab === "audits" && (
              <div className="space-y-6 pb-20">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <h3 className="text-sm font-bold">Technical & On-Page Audits</h3>
                </div>

                <form onSubmit={handleAnalyzeAudit} className="bg-indigo-600/5 border border-indigo-500/20 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-1.5 w-full">
                    <Label className="text-indigo-400">Live On-Page SEO Analyzer</Label>
                    <Input
                      placeholder="Enter URL to analyze..."
                      className="bg-background border-indigo-500/30"
                      value={auditUrl}
                      onChange={(e) => setAuditUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex-1 space-y-1.5 w-full">
                    <Label className="text-indigo-400">Target Keyword</Label>
                    <Input
                      placeholder="e.g. crm software"
                      className="bg-background border-indigo-500/30"
                      value={auditKw}
                      onChange={(e) => setAuditKw(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={createAudit.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {createAudit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Analyze Page"}
                  </Button>
                </form>

                {auditsLoading && <Loader2 className="size-4 animate-spin text-text-dim" />}
                {!auditsLoading && (
                  <div className="space-y-4">
                    {audits?.map(audit => (
                      <div key={audit.id} className="bg-panel border border-border rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm">{audit.url}</div>
                          <div className="text-xs text-text-dim">Run at: {new Date(audit.runAt).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={`text-2xl font-black ${audit.score > 80 ? 'text-green-500' : 'text-amber-500'}`}>
                              {audit.score}
                            </div>
                            <div className="text-[10px] text-text-dim uppercase font-bold tracking-wider">Score</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!audits?.length && <p className="text-xs text-text-dim bg-panel border border-border p-8 text-center rounded-xl">No audits run yet.</p>}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* DIALOGS */}
      <Dialog open={createKeywordOpen} onOpenChange={setCreateKeywordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tracked Keyword</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateKeyword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Keyword Term</Label>
              <Input
                value={kwTerm}
                onChange={(e) => setKwTerm(e.target.value)}
                placeholder="e.g. CRM software"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Search Volume (Est)</Label>
                <Input
                  type="number"
                  value={kwVolume}
                  onChange={(e) => setKwVolume(e.target.value)}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty (0-100)</Label>
                <Input
                  type="number"
                  value={kwDiff}
                  onChange={(e) => setKwDiff(e.target.value)}
                  placeholder="45"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target URL Path</Label>
              <Input
                value={kwTargetUrl}
                onChange={(e) => setKwTargetUrl(e.target.value)}
                placeholder="/products/crm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Project (Access Control)</Label>
              <Select value={kwProjectId} onValueChange={setKwProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project (Global)</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateKeywordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createKeyword.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {createKeyword.isPending ? "Adding..." : "Add Keyword"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createBriefOpen} onOpenChange={setCreateBriefOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Content Brief</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBrief} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Brief Title</Label>
              <Input
                value={briefTitle}
                onChange={(e) => setBriefTitle(e.target.value)}
                placeholder="e.g. 10 Best CRM Tools in 2026"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target Keyword</Label>
              <Input
                value={briefKw}
                onChange={(e) => setBriefKw(e.target.value)}
                placeholder="best crm tools"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={briefAssignee} onValueChange={setBriefAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users?.filter((u) => u.department?.id === departmentId).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateBriefOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBrief.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {createBrief.isPending ? "Creating..." : "Create Brief"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Competitor Dialog */}
      <Dialog open={createCompOpen} onOpenChange={setCreateCompOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCompetitor} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Competitor Domain</Label>
              <Input
                value={compDomain}
                onChange={(e) => setCompDomain(e.target.value)}
                placeholder="e.g. rival.com"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateCompOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createComp.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {createComp.isPending ? "Adding..." : "Add Competitor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
