import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  Rocket,
  Search,
  Loader2,
  Building2,
  UserPlus,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Mail,
  Plus,
  Pencil,
  ListChecks,
  Activity,
  PlayCircle,
} from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useApolloConnection } from "@/hooks/use-apollo";
import {
  useSearchApolloPeople,
  useSearchApolloOrganizations,
  useImportApolloPeople,
  useImportApolloOrganizations,
} from "@/hooks/use-apollo";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { EmailTemplateFormDialog } from "@/components/email-template-form-dialog";
import { SequenceFormDialog } from "@/components/sequence-form-dialog";
import { SequenceEnrollDialog } from "@/components/sequence-enroll-dialog";
import { useSequences, useSequenceActivity, useRunSequenceEngine } from "@/hooks/use-sequences";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApolloOrganizationPreview, ApolloPersonPreview } from "@/lib/api/apollo";
import type { EmailTemplate, Sequence } from "@/lib/api/types";

export const Route = createFileRoute("/_app/outreach")({
  component: OutreachPage,
});

function commaList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function ApolloConnectionNotice() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-4 text-sm">
      <AlertCircle className="size-5 text-warning shrink-0" />
      <div>
        <p className="font-semibold">Apollo isn't connected yet.</p>
        <p className="text-text-dim mt-0.5">
          Ask an Admin to connect it under Settings → Apollo.io Connection.
        </p>
      </div>
    </div>
  );
}

function OutreachPage() {
  useDepartmentGuard("Sales");
  const { data: connection, isLoading: connectionLoading } = useApolloConnection();
  const apolloConnected = !!connection?.connected;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start gap-4 border-b border-border-subtle pb-5">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Rocket className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Outreach</h1>
          <p className="text-xs text-text-dim mt-0.5 max-w-2xl">
            Find and import leads from Apollo.io, build reusable email
            templates, and run automated drip sequences.
          </p>
        </div>
      </div>

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">
            <Users className="size-3.5 mr-1.5" />
            Find People
          </TabsTrigger>
          <TabsTrigger value="companies">
            <Building2 className="size-3.5 mr-1.5" />
            Find Companies
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Mail className="size-3.5 mr-1.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="sequences">
            <ListChecks className="size-3.5 mr-1.5" />
            Sequences
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="size-3.5 mr-1.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-4">
          {connectionLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-dim py-8">
              <Loader2 className="size-4 animate-spin" /> Checking Apollo connection…
            </div>
          ) : apolloConnected ? (
            <FindPeopleTab />
          ) : (
            <ApolloConnectionNotice />
          )}
        </TabsContent>
        <TabsContent value="companies" className="mt-4">
          {connectionLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-dim py-8">
              <Loader2 className="size-4 animate-spin" /> Checking Apollo connection…
            </div>
          ) : apolloConnected ? (
            <FindCompaniesTab />
          ) : (
            <ApolloConnectionNotice />
          )}
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="sequences" className="mt-4">
          <SequencesTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Find People ────────────────────────────────────────────────────────────

function FindPeopleTab() {
  const searchPeople = useSearchApolloPeople();
  const importPeople = useImportApolloPeople();

  const [titles, setTitles] = useState("");
  const [keywords, setKeywords] = useState("");
  const [locations, setLocations] = useState("");
  const [results, setResults] = useState<ApolloPersonPreview[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSelected({});
    const found = await searchPeople.mutateAsync({
      personTitles: commaList(titles),
      keywords: keywords.trim() || undefined,
      locations: commaList(locations),
      perPage: 25,
    });
    setResults(found);
  }

  async function handleImport() {
    setNotice(null);
    const imported = await importPeople.mutateAsync(selectedIds);
    setNotice(`Imported ${imported.length} contact${imported.length !== 1 ? "s" : ""} into the CRM.`);
    setResults((prev) => prev.filter((p) => !selectedIds.includes(p.apolloId)));
    setSelected({});
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearch}
        className="bg-panel border border-border rounded-xl p-4 grid sm:grid-cols-3 gap-3 items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="op-titles">Job titles</Label>
          <Input
            id="op-titles"
            value={titles}
            onChange={(e) => setTitles(e.target.value)}
            placeholder="Founder, CEO, VP Sales"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-locations">Locations</Label>
          <Input
            id="op-locations"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="India, United States"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-keywords">Keywords</Label>
          <Input
            id="op-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. SaaS"
          />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={searchPeople.isPending} className="gap-1.5">
            {searchPeople.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search Apollo
          </Button>
        </div>
      </form>

      {notice && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> {notice}
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-sm font-semibold">{results.length} results</span>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={selectedIds.length === 0 || importPeople.isPending}
              className="gap-1.5"
            >
              {importPeople.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              Import Selected ({selectedIds.length})
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((p) => (
                <TableRow key={p.apolloId}>
                  <TableCell>
                    <Checkbox
                      checked={!!selected[p.apolloId]}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => ({ ...prev, [p.apolloId]: !!checked }))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.firstName} {p.lastNamePreview ?? ""}
                  </TableCell>
                  <TableCell className="text-sm text-text-dim">{p.title ?? "—"}</TableCell>
                  <TableCell className="text-sm text-text-dim">{p.organizationName ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-4 py-2.5 text-[10px] text-text-dim border-t border-border-subtle">
            Names/emails are revealed only when you import a contact — searching doesn't use Apollo credits.
          </p>
        </div>
      )}

      {!searchPeople.isPending && searchPeople.isSuccess && results.length === 0 && (
        <p className="text-sm text-text-dim py-8 text-center">No results for that search.</p>
      )}
    </div>
  );
}

// ─── Find Companies ─────────────────────────────────────────────────────────

function FindCompaniesTab() {
  const searchOrgs = useSearchApolloOrganizations();
  const importOrgs = useImportApolloOrganizations();

  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [locations, setLocations] = useState("");
  const [results, setResults] = useState<ApolloOrganizationPreview[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const selectedDomains = useMemo(
    () => Object.keys(selected).filter((domain) => selected[domain]),
    [selected],
  );

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSelected({});
    const found = await searchOrgs.mutateAsync({
      name: name.trim() || undefined,
      keywords: keywords.trim() || undefined,
      locations: commaList(locations),
      perPage: 25,
    });
    setResults(found);
  }

  async function handleImport() {
    setNotice(null);
    const imported = await importOrgs.mutateAsync(selectedDomains);
    setNotice(`Imported ${imported.length} compan${imported.length !== 1 ? "ies" : "y"} into the CRM.`);
    setResults((prev) => prev.filter((o) => !o.domain || !selectedDomains.includes(o.domain)));
    setSelected({});
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearch}
        className="bg-panel border border-border rounded-xl p-4 grid sm:grid-cols-3 gap-3 items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="oc-name">Company name</Label>
          <Input id="oc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Apollo" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oc-locations">Locations</Label>
          <Input
            id="oc-locations"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="India, United States"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oc-keywords">Keywords</Label>
          <Input
            id="oc-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. healthcare"
          />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={searchOrgs.isPending} className="gap-1.5">
            {searchOrgs.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search Apollo
          </Button>
        </div>
      </form>

      {notice && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> {notice}
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-sm font-semibold">{results.length} results</span>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={selectedDomains.length === 0 || importOrgs.isPending}
              className="gap-1.5"
            >
              {importOrgs.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              Import Selected ({selectedDomains.length})
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Employees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((o) => (
                <TableRow key={o.apolloId ?? o.domain ?? o.name}>
                  <TableCell>
                    <Checkbox
                      checked={!!o.domain && !!selected[o.domain]}
                      disabled={!o.domain}
                      onCheckedChange={(checked) =>
                        o.domain && setSelected((prev) => ({ ...prev, [o.domain!]: !!checked }))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm">{o.name}</TableCell>
                  <TableCell className="text-sm text-text-dim">{o.domain ?? "—"}</TableCell>
                  <TableCell className="text-sm text-text-dim">{o.industry ?? "—"}</TableCell>
                  <TableCell className="text-sm text-text-dim">{o.employeeCount ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!searchOrgs.isPending && searchOrgs.isSuccess && results.length === 0 && (
        <p className="text-sm text-text-dim py-8 text-center">No results for that search.</p>
      )}
    </div>
  );
}

// ─── Templates ──────────────────────────────────────────────────────────────

function TemplatesTab() {
  const { data: templates, isLoading } = useEmailTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>(undefined);

  function openCreate() {
    setEditingTemplate(undefined);
    setDialogOpen(true);
  }

  function openEdit(template: EmailTemplate) {
    setEditingTemplate(template);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-dim">
          Reusable emails with merge fields. Any Sales teammate can edit any template.
        </p>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-3.5" />
          New Template
        </Button>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && templates?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  No templates yet. Click "New Template" to create one.
                </TableCell>
              </TableRow>
            )}
            {templates?.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => openEdit(t)}>
                <TableCell className="font-medium text-sm">{t.name}</TableCell>
                <TableCell className="text-sm text-text-dim truncate max-w-xs">{t.subject}</TableCell>
                <TableCell className="text-sm text-text-dim">
                  {t.creator.firstName} {t.creator.lastName}
                </TableCell>
                <TableCell className="text-sm text-text-dim">
                  {new Date(t.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Pencil className="size-3.5 text-text-dim" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmailTemplateFormDialog open={dialogOpen} onOpenChange={setDialogOpen} template={editingTemplate} />
    </div>
  );
}

// ─── Sequences ──────────────────────────────────────────────────────────────

const SEQUENCE_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-canvas/50 text-text-dim border-border-subtle",
  ACTIVE: "bg-success/15 text-success border-success/20",
  PAUSED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  ARCHIVED: "bg-muted text-text-dim border-border-subtle",
};

function SequencesTab() {
  const { data: sequences, isLoading } = useSequences();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";
  const runEngine = useRunSequenceEngine();

  const [formOpen, setFormOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | undefined>(undefined);
  const [enrollingSequence, setEnrollingSequence] = useState<Sequence | undefined>(undefined);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);

  function openCreate() {
    setEditingSequence(undefined);
    setFormOpen(true);
  }

  function openEdit(seq: Sequence) {
    setEditingSequence(seq);
    setFormOpen(true);
  }

  function openEnroll(seq: Sequence) {
    setEnrollingSequence(seq);
    setEnrollOpen(true);
  }

  async function handleRunEngine() {
    setEngineNotice(null);
    const res = await runEngine.mutateAsync();
    setEngineNotice(`Processed ${res.processed} due enrollment${res.processed !== 1 ? "s" : ""}.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-dim">
          Multi-step drip campaigns. Only ACTIVE sequences send scheduled emails.
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunEngine}
              disabled={runEngine.isPending}
              className="gap-1.5"
              title="Manually process due sends now, instead of waiting for the next scheduled run"
            >
              {runEngine.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PlayCircle className="size-3.5" />
              )}
              Run engine now
            </Button>
          )}
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="size-3.5" />
            New Sequence
          </Button>
        </div>
      </div>
      {engineNotice && <p className="text-xs text-success">{engineNotice}</p>}

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && sequences?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  No sequences yet. Click "New Sequence" to build one.
                </TableCell>
              </TableRow>
            )}
            {sequences?.map((seq) => (
              <TableRow key={seq.id}>
                <TableCell className="font-medium text-sm">{seq.name}</TableCell>
                <TableCell>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${SEQUENCE_STATUS_STYLES[seq.status]}`}
                  >
                    {seq.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-text-dim">{seq.steps.length}</TableCell>
                <TableCell className="text-sm text-text-dim">{seq._count.enrollments}</TableCell>
                <TableCell className="text-right space-x-3">
                  <button
                    type="button"
                    onClick={() => openEnroll(seq)}
                    className="text-xs text-primary hover:underline"
                  >
                    Enroll
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(seq)}
                    className="text-xs text-text-dim hover:text-foreground"
                  >
                    Edit
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SequenceFormDialog open={formOpen} onOpenChange={setFormOpen} sequence={editingSequence} />
      <SequenceEnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} sequence={enrollingSequence} />
    </div>
  );
}

// ─── Activity ───────────────────────────────────────────────────────────────

function ActivityTab() {
  const { data: activity, isLoading } = useSequenceActivity();

  return (
    <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Sequence</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-text-dim py-8">
                <Loader2 className="size-4 animate-spin mx-auto" />
              </TableCell>
            </TableRow>
          )}
          {!isLoading && activity?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-text-dim py-8">
                No sends yet.
              </TableCell>
            </TableRow>
          )}
          {activity?.map((send) => (
            <TableRow key={send.id}>
              <TableCell className="text-sm">
                {send.enrollment.contact.firstName} {send.enrollment.contact.lastName}
              </TableCell>
              <TableCell className="text-sm text-text-dim">{send.enrollment.sequence.name}</TableCell>
              <TableCell className="text-sm text-text-dim">
                {send.step?.template.name ?? <span className="italic">deleted step</span>}
              </TableCell>
              <TableCell>
                {send.status === "SENT" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-success">
                    <CheckCircle2 className="size-3" /> Sent
                  </span>
                ) : send.status === "PENDING" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-text-dim">
                    <Loader2 className="size-3 animate-spin" /> Sending
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-destructive"
                    title={send.errorMessage ?? undefined}
                  >
                    <XCircle className="size-3" /> Failed
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-text-dim">
                {new Date(send.sentAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
