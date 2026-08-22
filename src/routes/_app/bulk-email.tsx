import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import {
  Search,
  Send,
  Loader2,
  Users,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Square,
  CheckSquare,
  UploadCloud,
} from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useContacts } from "@/hooks/use-contacts";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { useEmailConnectionStatus } from "@/hooks/use-email-connections";
import {
  useBulkEmailCampaigns,
  useBulkEmailCampaign,
  useCreateBulkEmailCampaign,
  useRunBulkEmailEngine,
} from "@/hooks/use-bulk-email";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BulkEmailComposer, type ComposeMode } from "@/components/bulk-email-composer";
import { ApiError } from "@/lib/api/client";
import type { BulkEmailCampaign, BulkSendStatus, Contact } from "@/lib/api/types";

export const Route = createFileRoute("/_app/bulk-email")({
  component: BulkEmailPage,
});

type SourceFilter = "ALL" | "APOLLO" | "MANUAL";

const STATUS_STYLES: Record<BulkSendStatus, string> = {
  PENDING: "bg-canvas/50 text-text-dim border-border-subtle",
  SENT: "bg-success/15 text-success border-success/20",
  FAILED: "bg-destructive/15 text-destructive border-destructive/20",
  SKIPPED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRawEmails(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => EMAIL_RE.test(s)),
    ),
  );
}

// Scans every cell of every sheet row for anything email-shaped rather than
// trying to identify "the" email column -- the file might be a plain list
// with no header at all, or a full contacts export (like the one Export CSV
// on the Contacts page produces) where the email column could be anywhere.
// Since this feature only ever wants emails out of the file, brute-force
// cell scanning is both simpler and more robust than column mapping.
function extractEmailsFromSheet(rows: string[][]): string[] {
  const found = new Set<string>();
  for (const row of rows) {
    for (const cell of row) {
      const value = String(cell ?? "")
        .trim()
        .toLowerCase();
      if (EMAIL_RE.test(value)) found.add(value);
    }
  }
  return Array.from(found);
}

function BulkEmailPage() {
  useDepartmentGuard("Sales");
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";

  const { data: templates } = useEmailTemplates();
  const { data: contacts } = useContacts();
  const { data: campaigns, isLoading: campaignsLoading } = useBulkEmailCampaigns();
  const { data: emailConnection, isLoading: emailConnectionLoading } = useEmailConnectionStatus();
  const createCampaign = useCreateBulkEmailCampaign();
  const runEngine = useRunBulkEmailEngine();

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  // A campaign's email comes from either a saved template or a one-off
  // written right here for these recipients only -- see BulkEmailComposer.
  const [composeMode, setComposeMode] = useState<ComposeMode>("TEMPLATE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [appendSignature, setAppendSignature] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [rawEmailsInput, setRawEmailsInput] = useState("");
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);
  const smtpReady = !!emailConnection?.connected && !!emailConnection?.verified;
  // A shared HTTP sender (Resend/SendGrid) can stand in when SMTP isn't
  // connected/verified -- see EmailConnectionsService.requireSendable on the
  // backend. Sending is only actually blocked when neither is available.
  const senderReady = smtpReady || !!emailConnection?.httpFallbackAvailable;
  const [viewingCampaign, setViewingCampaign] = useState<BulkEmailCampaign | undefined>(undefined);
  const [contactQuery, setContactQuery] = useState("");

  const eligibleContacts = useMemo(() => {
    const withEmail = (contacts ?? []).filter((c): c is Contact & { email: string } => !!c.email);
    const bySource =
      sourceFilter === "ALL" ? withEmail : withEmail.filter((c) => c.source === sourceFilter);
    const term = contactQuery.trim().toLowerCase();
    if (!term) return bySource;
    return bySource.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.company?.name ?? "").toLowerCase().includes(term),
    );
  }, [contacts, sourceFilter, contactQuery]);

  const selectedContactIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );
  const rawEmails = useMemo(() => parseRawEmails(rawEmailsInput), [rawEmailsInput]);
  const totalRecipients = selectedContactIds.length + rawEmails.length;

  // Previewing against a real person on this send beats an invented sample --
  // the rep sees exactly what the first recipient will get.
  const previewContact = useMemo(
    () => eligibleContacts.find((c) => c.id === selectedContactIds[0]),
    [eligibleContacts, selectedContactIds],
  );
  const hasContent =
    composeMode === "TEMPLATE" ? !!templateId : subject.trim().length > 0 && body.trim().length > 0;

  // Lets a rep upload a CSV/Excel file of recipients (e.g. one exported from
  // Contacts, or the same file they used to import contacts in the first
  // place) instead of hand-picking contacts one at a time below. Every email
  // found in the file that matches an existing CRM contact gets selected
  // there (so it keeps personalization + is linked for the Email History
  // panel); anything else is added to the raw-emails box.
  async function handleRecipientFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    setFileNotice(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
      const emails = extractEmailsFromSheet(rows);

      if (emails.length === 0) {
        setFileError("No email addresses found in that file.");
        return;
      }

      const contactIdByEmail = new Map(
        (contacts ?? []).filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id]),
      );
      const newlySelected: Record<string, boolean> = {};
      const unmatched: string[] = [];
      for (const email of emails) {
        const contactId = contactIdByEmail.get(email);
        if (contactId) {
          newlySelected[contactId] = true;
        } else {
          unmatched.push(email);
        }
      }

      setSelected((prev) => ({ ...prev, ...newlySelected }));
      if (unmatched.length > 0) {
        setRawEmailsInput((prev) =>
          Array.from(new Set([...parseRawEmails(prev), ...unmatched])).join("\n"),
        );
      }

      const matchedCount = emails.length - unmatched.length;
      setFileNotice(
        `Loaded ${emails.length} email${emails.length !== 1 ? "s" : ""} from "${file.name}" -- ` +
          `${matchedCount} matched existing contacts, ${unmatched.length} added as new.`,
      );
    } catch {
      setFileError(
        "Couldn't read that file -- make sure it's a valid .csv, .xlsx, .xls, or .xlsm file.",
      );
    }
  }

  function toggleSelectAll() {
    const allSelected = eligibleContacts.every((c) => selected[c.id]);
    setSelected(Object.fromEntries(eligibleContacts.map((c) => [c.id, !allSelected])));
  }

  async function handleSend() {
    if (!hasContent || totalRecipients === 0) return;
    setNotice(null);
    setSendError(null);
    try {
      const campaign = await createCampaign.mutateAsync({
        name: name.trim() || `Bulk send — ${new Date().toLocaleDateString()}`,
        ...(composeMode === "TEMPLATE"
          ? { templateId }
          : // Sent as typed: the server runs the plain-text-to-HTML pass at send
            // time (composeEmailHtml), so line breaks survive without the body
            // being stored as markup the rep never wrote.
            { subject: subject.trim(), bodyHtml: body.trim() }),
        appendSignature,
        contactIds: selectedContactIds.length > 0 ? selectedContactIds : undefined,
        rawEmails: rawEmails.length > 0 ? rawEmails : undefined,
      });
      setNotice(
        `Queued "${campaign.name}" for ${campaign._count.recipients} recipient${campaign._count.recipients !== 1 ? "s" : ""}. Sending happens in the background over the next few minutes.`,
      );
      setName("");
      setSubject("");
      setBody("");
      setSelected({});
      setRawEmailsInput("");
      setFileNotice(null);
      setFileError(null);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Could not queue this campaign");
    }
  }

  async function handleRunEngine() {
    setEngineNotice(null);
    const res = await runEngine.mutateAsync();
    setEngineNotice(`Processed ${res.processed} pending send${res.processed !== 1 ? "s" : ""}.`);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start gap-4 border-b border-border-subtle pb-5">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Send className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bulk Email</h1>
          <p className="text-xs text-text-dim mt-0.5 max-w-2xl">
            Send one template to many recipients at once. Sends are throttled in the background so a
            large list doesn't go out all in one second.
          </p>
        </div>
      </div>

      {!emailConnectionLoading && !senderReady && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-4 text-sm">
          <AlertCircle className="size-5 text-warning shrink-0" />
          <div>
            <p className="font-semibold">Connect your email to send bulk campaigns.</p>
            <p className="text-text-dim mt-0.5">
              Campaigns send from your own mailbox, not a shared address.{" "}
              <Link to="/account" className="text-primary hover:underline">
                Connect it in your profile
              </Link>
              .
            </p>
          </div>
        </div>
      )}
      {!emailConnectionLoading && !smtpReady && senderReady && (
        <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-canvas/30 px-4 py-3 text-sm">
          <AlertCircle className="size-4 text-text-dim shrink-0" />
          <p className="text-text-dim">
            No mailbox connected yet, so this will send from a shared address for now (replies still
            route back to you).{" "}
            <Link to="/account" className="text-primary hover:underline">
              Connect your own mailbox
            </Link>{" "}
            to send as yourself instead.
          </p>
        </div>
      )}

      <div className="bg-panel border border-border rounded-xl p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="be-name">Campaign name (optional)</Label>
          <Input
            id="be-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 SaaS founders outreach"
          />
        </div>

        <div className="border-t border-border-subtle pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              <Users className="size-3.5" /> CRM contacts
            </Label>
            <div className="flex items-center gap-1">
              {(["ALL", "APOLLO", "MANUAL"] as SourceFilter[]).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSourceFilter(source)}
                  className={`text-[10px] px-2 py-1 rounded-full border font-medium ${
                    sourceFilter === source
                      ? "bg-primary/15 text-primary border-primary/20"
                      : "bg-canvas/50 text-text-dim border-border-subtle hover:text-foreground"
                  }`}
                >
                  {source === "ALL" ? "All" : source === "APOLLO" ? "From Apollo" : "Manual"}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
            <Input
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
              placeholder="Search name, email, or company…"
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-48 border border-border-subtle rounded-lg">
            <div className="p-1.5 space-y-0.5">
              {eligibleContacts.length === 0 ? (
                <p className="text-[10px] text-text-dim p-2">
                  {contactQuery
                    ? "No contacts match that search."
                    : "No contacts with an email on file match this filter."}
                </p>
              ) : (
                eligibleContacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-canvas/40 cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={!!selected[c.id]}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => ({ ...prev, [c.id]: !!checked }))
                      }
                    />
                    <span className="flex-1 truncate">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="text-text-dim truncate max-w-[160px]">{c.email}</span>
                    {c.source === "APOLLO" && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        Apollo
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={eligibleContacts.length === 0}
            className="text-[10px] text-text-dim hover:text-foreground flex items-center gap-1 disabled:opacity-50"
          >
            {eligibleContacts.length > 0 && eligibleContacts.every((c) => selected[c.id]) ? (
              <CheckSquare className="size-3" />
            ) : (
              <Square className="size-3" />
            )}
            Select all ({eligibleContacts.length})
          </button>
        </div>

        <div className="border-t border-border-subtle pt-4 space-y-1.5">
          <Label htmlFor="be-raw-emails">Additional emails (not yet in the CRM)</Label>
          <Textarea
            id="be-raw-emails"
            value={rawEmailsInput}
            onChange={(e) => setRawEmailsInput(e.target.value)}
            placeholder="Paste emails separated by commas or new lines, or paste a CSV column"
            className="min-h-20 text-xs"
          />
          <p className="text-[10px] text-text-dim">
            {rawEmails.length > 0
              ? `${rawEmails.length} valid email${rawEmails.length !== 1 ? "s" : ""} recognized.`
              : "These won't get name/company personalization since they're not linked to a CRM contact."}
          </p>
        </div>

        <div className="border-t border-border-subtle pt-4 space-y-1.5">
          <Label>Or upload a CSV/Excel file of recipients</Label>
          <label className="flex items-center gap-2 border border-dashed border-border-subtle rounded-lg px-3 py-2.5 cursor-pointer hover:border-primary/40 hover:bg-canvas/30 transition-colors text-xs text-text-dim">
            <UploadCloud className="size-4 shrink-0" />
            <span>
              Click to choose a .csv, .xlsx, .xls, or .xlsm file — every email address found in it
              (e.g. one exported from Contacts) is added above automatically, matched against
              existing contacts where possible.
            </span>
            <Input
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12,text/csv"
              onChange={handleRecipientFileChange}
              className="hidden"
            />
          </label>
          {fileNotice && (
            <p className="text-[10px] text-success flex items-center gap-1">
              <CheckCircle2 className="size-3" /> {fileNotice}
            </p>
          )}
          {fileError && (
            <p className="text-[10px] text-destructive flex items-center gap-1">
              <AlertCircle className="size-3" /> {fileError}
            </p>
          )}
        </div>

        <BulkEmailComposer
          mode={composeMode}
          onModeChange={setComposeMode}
          templates={templates}
          templateId={templateId}
          onTemplateIdChange={setTemplateId}
          subject={subject}
          onSubjectChange={setSubject}
          body={body}
          onBodyChange={setBody}
          previewContact={previewContact}
          hasUnlinkedRecipients={rawEmails.length > 0}
          appendSignature={appendSignature}
          onAppendSignatureChange={setAppendSignature}
        />

        {notice && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" /> {notice}
          </div>
        )}
        {sendError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" /> {sendError}
          </div>
        )}

        <div className="border-t border-border-subtle pt-4 flex items-center justify-between">
          <span className="text-xs text-text-dim">
            {totalRecipients} recipient{totalRecipients !== 1 ? "s" : ""} selected
          </span>
          <Button
            onClick={handleSend}
            disabled={
              !hasContent || totalRecipients === 0 || createCampaign.isPending || !senderReady
            }
            className="gap-1.5"
          >
            {createCampaign.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send to {totalRecipients || ""}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Campaign history</h2>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunEngine}
              disabled={runEngine.isPending}
              className="gap-1.5"
              title="Manually process pending sends now, instead of waiting for the next scheduled run"
            >
              {runEngine.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PlayCircle className="size-3.5" />
              )}
              Run engine now
            </Button>
          )}
        </div>
        {engineNotice && <p className="text-xs text-success">{engineNotice}</p>}

        <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignsLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-dim py-8">
                    <Loader2 className="size-4 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              )}
              {!campaignsLoading && campaigns?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-dim py-8">
                    No campaigns yet.
                  </TableCell>
                </TableRow>
              )}
              {campaigns?.map((c) => {
                const sent = c.statusCounts.SENT ?? 0;
                const failed = c.statusCounts.FAILED ?? 0;
                const skipped = c.statusCounts.SKIPPED ?? 0;
                const pending = c.statusCounts.PENDING ?? 0;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setViewingCampaign(c)}
                  >
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="text-sm text-text-dim">
                      {c.template?.name ?? (
                        <span className="italic" title={c.subject ?? undefined}>
                          One-off email
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">{c._count.recipients}</TableCell>
                    <TableCell className="text-[10px] space-x-1">
                      {sent > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.SENT}`}>
                          {sent} sent
                        </span>
                      )}
                      {pending > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.PENDING}`}
                        >
                          {pending} pending
                        </span>
                      )}
                      {failed > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.FAILED}`}
                        >
                          {failed} failed
                        </span>
                      )}
                      {skipped > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.SKIPPED}`}
                        >
                          {skipped} skipped
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">
                      {c.creator.firstName} {c.creator.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">
                      {new Date(c.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <CampaignDetailDialog
        campaignId={viewingCampaign?.id}
        onOpenChange={(open) => !open && setViewingCampaign(undefined)}
      />
    </div>
  );
}

function CampaignDetailDialog({
  campaignId,
  onOpenChange,
}: {
  campaignId: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: campaign, isLoading } = useBulkEmailCampaign(campaignId);

  return (
    <Dialog open={!!campaignId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign?.name ?? "Campaign"}</DialogTitle>
        </DialogHeader>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-text-dim py-8 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}
        {campaign && (
          <ScrollArea className="h-96">
            <div className="space-y-1">
              {campaign.recipients.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-canvas/30 border border-border-subtle"
                >
                  <div className="min-w-0">
                    <p className="text-xs truncate">
                      {r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : r.email}
                    </p>
                    {r.contact && <p className="text-[10px] text-text-dim truncate">{r.email}</p>}
                    {r.errorMessage && (
                      <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
                        <AlertCircle className="size-2.5" /> {r.errorMessage}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_STYLES[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
