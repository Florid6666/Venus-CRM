import { useMemo, useRef, useState } from "react";
import { FileText, PenLine, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderMergeFields } from "@/lib/merge-fields";
import { plainTextToHtml } from "@/lib/plain-text-to-html";
import { EmailHtmlPreview } from "@/components/email-html-preview";
import { Checkbox } from "@/components/ui/checkbox";
import { useSignature } from "@/hooks/use-email-signature";
import type { Contact, EmailTemplate } from "@/lib/api/types";

export type ComposeMode = "TEMPLATE" | "INLINE";

// What each placeholder resolves to at send time, spelled out rather than
// listed bare -- reps kept asking which field "title" meant and whether a
// pasted email would get a name (it doesn't).
const MERGE_FIELDS: Array<{ token: string; label: string; source: string }> = [
  { token: "{{firstName}}", label: "First name", source: "Contact’s first name" },
  { token: "{{lastName}}", label: "Last name", source: "Contact’s last name" },
  { token: "{{title}}", label: "Job title", source: "Contact’s title, e.g. “VP of Sales”" },
  {
    token: "{{companyName}}",
    label: "Company",
    source: "Name of the company linked to that contact",
  },
];

// Stand-in used for the preview when no CRM contact is selected yet -- same
// sample the Templates editor previews against, so both read alike.
const SAMPLE_CONTACT = {
  firstName: "Jordan",
  lastName: "Lee",
  title: "VP of Sales",
  companyName: "Acme Inc.",
};

interface BulkEmailComposerProps {
  mode: ComposeMode;
  onModeChange: (mode: ComposeMode) => void;
  templates: EmailTemplate[] | undefined;
  templateId: string;
  onTemplateIdChange: (id: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  // First selected recipient, so the preview shows a person actually on this
  // send rather than an invented sample.
  previewContact?: Contact;
  // Whether any recipient on this send is a pasted email with no CRM contact
  // behind it -- those get blank merge fields, which is worth warning about
  // before the send, not after.
  hasUnlinkedRecipients: boolean;
  appendSignature: boolean;
  onAppendSignatureChange: (value: boolean) => void;
}

export function BulkEmailComposer({
  mode,
  onModeChange,
  templates,
  templateId,
  onTemplateIdChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  previewContact,
  hasUnlinkedRecipients,
  appendSignature,
  onAppendSignatureChange,
}: BulkEmailComposerProps) {
  const { data: signature } = useSignature();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Which field a merge-field chip drops into -- whichever was focused last,
  // defaulting to the body since that's where most of them go.
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");

  const selectedTemplate = templates?.find((t) => t.id === templateId);
  const previewSource = useMemo(
    () =>
      previewContact
        ? {
            firstName: previewContact.firstName,
            lastName: previewContact.lastName,
            title: previewContact.title ?? undefined,
            companyName: previewContact.company?.name ?? undefined,
          }
        : SAMPLE_CONTACT,
    [previewContact],
  );

  const rawSubject = mode === "TEMPLATE" ? (selectedTemplate?.subject ?? "") : subject;
  const rawBody = mode === "TEMPLATE" ? (selectedTemplate?.bodyHtml ?? "") : body;
  const previewSubject = useMemo(
    () => renderMergeFields(rawSubject, previewSource),
    [rawSubject, previewSource],
  );
  // Built the same way the server will build it -- merge fields, then the
  // plain-text-to-HTML pass, then the signature -- so the preview is the
  // delivered email, not an approximation of it.
  const previewBody = useMemo(() => {
    const html = plainTextToHtml(renderMergeFields(rawBody, previewSource));
    return appendSignature && signature?.html
      ? `${html}<div style="margin-top:1.5em">${signature.html}</div>`
      : html;
  }, [rawBody, previewSource, appendSignature, signature]);

  function insertToken(token: string) {
    if (lastFocused === "subject") {
      onSubjectChange(spliceAtCursor(subjectRef.current, subject, token));
      subjectRef.current?.focus();
    } else {
      onBodyChange(spliceAtCursor(bodyRef.current, body, token));
      bodyRef.current?.focus();
    }
  }

  return (
    <div className="border-t border-border-subtle pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label>Email content</Label>
        <div className="flex items-center gap-1">
          <ModeTab
            active={mode === "TEMPLATE"}
            onClick={() => onModeChange("TEMPLATE")}
            icon={<FileText className="size-3" />}
            label="Saved template"
          />
          <ModeTab
            active={mode === "INLINE"}
            onClick={() => onModeChange("INLINE")}
            icon={<PenLine className="size-3" />}
            label="Write a new email"
          />
        </div>
      </div>

      {mode === "TEMPLATE" ? (
        <div className="space-y-1.5">
          <Select value={templateId} onValueChange={onTemplateIdChange}>
            <SelectTrigger id="be-template">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {templates?.length === 0 && (
            <p className="text-[10px] text-text-dim">
              No templates yet — create one under Outreach → Templates, or switch to “Write a new
              email” above.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="be-subject">Subject</Label>
            <Input
              id="be-subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              onFocus={() => setLastFocused("subject")}
              placeholder="Quick question, {{firstName}}"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="be-body">Body</Label>
            <Textarea
              id="be-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              onFocus={() => setLastFocused("body")}
              placeholder={
                "Hi {{firstName}},\n\nNoticed {{companyName}} is hiring across sales — worth a quick chat?\n\nBest,\nJon"
              }
              rows={9}
              className="text-xs font-mono"
            />
            <p className="text-[10px] text-text-dim">
              Plain text is fine — line breaks and blank lines are kept when the email goes out.
              This email is used only for this send; it isn’t added to the shared Templates list.
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-canvas/30 p-3 space-y-2">
            <p className="text-[10px] font-medium flex items-center gap-1.5">
              <Info className="size-3 text-primary" />
              Personalize it — click a field to drop it in where your cursor is
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_FIELDS.map((field) => (
                <button
                  key={field.token}
                  type="button"
                  onClick={() => insertToken(field.token)}
                  title={field.source}
                  className="text-[10px] font-mono px-2 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {field.token}
                </button>
              ))}
            </div>
            <ul className="space-y-0.5 pt-1">
              {MERGE_FIELDS.map((field) => (
                <li key={field.token} className="text-[10px] text-text-dim">
                  <code className="text-foreground">{field.token}</code> → {field.source}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-text-dim border-t border-border-subtle pt-2">
              Each recipient gets their own values filled in. A field with nothing behind it comes
              out empty, so write greetings that survive it —{" "}
              <code className="text-foreground">Hi {"{{firstName}}"},</code> reads as “Hi ,” for
              anyone without a name on file.
              {hasUnlinkedRecipients && (
                <>
                  {" "}
                  <span className="text-warning">
                    Some recipients on this send are pasted emails with no CRM contact, so every
                    field above will be blank for them.
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border-subtle bg-canvas/30 p-3">
        <Checkbox
          checked={appendSignature}
          onCheckedChange={(checked) => onAppendSignatureChange(!!checked)}
          className="mt-0.5"
        />
        <span className="text-[11px] leading-snug">
          Append my signature
          <span className="block text-[10px] text-text-dim">
            {signature?.html
              ? "Added below the message when this campaign sends."
              : "You haven’t set one up yet — Account → Email signature."}
          </span>
        </span>
      </label>

      <div className="space-y-1.5">
        <Label className="text-[10px] text-text-dim uppercase tracking-wide">
          Preview{" "}
          {previewContact
            ? `as ${previewContact.firstName} ${previewContact.lastName}`
            : "(sample recipient)"}
        </Label>
        <div className="rounded-lg border border-border-subtle bg-canvas/40 p-3 space-y-2">
          <p className="text-sm font-semibold border-b border-border-subtle pb-2">
            {previewSubject || (
              <span className="text-text-dim italic font-normal">(no subject)</span>
            )}
          </p>
          {previewBody ? (
            <EmailHtmlPreview html={previewBody} className="h-56" />
          ) : (
            <p className="text-xs italic text-text-dim">(empty body)</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[10px] px-2 py-1 rounded-full border font-medium flex items-center gap-1 ${
        active
          ? "bg-primary/15 text-primary border-primary/20"
          : "bg-canvas/50 text-text-dim border-border-subtle hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Inserts at the caret rather than appending, so clicking {{firstName}} while
// mid-sentence lands it where the writer is actually typing.
function spliceAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  token: string,
): string {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  return value.slice(0, start) + token + value.slice(end);
}
