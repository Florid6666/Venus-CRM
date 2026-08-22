import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import {
  useCreateEmailTemplate,
  useDeleteEmailTemplate,
  useUpdateEmailTemplate,
} from "@/hooks/use-email-templates";
import { renderMergeFields } from "@/lib/merge-fields";
import { plainTextToHtml } from "@/lib/plain-text-to-html";
import { EmailHtmlPreview } from "@/components/email-html-preview";
import { Checkbox } from "@/components/ui/checkbox";
import { useSignature } from "@/hooks/use-email-signature";
import type { EmailTemplate } from "@/lib/api/types";

const PREVIEW_SAMPLE = {
  firstName: "Jordan",
  lastName: "Lee",
  title: "VP of Sales",
  companyName: "Acme Inc.",
};

interface EmailTemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: EmailTemplate;
}

export function EmailTemplateFormDialog({
  open,
  onOpenChange,
  template,
}: EmailTemplateFormDialogProps) {
  const isEdit = !!template;
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [appendSignature, setAppendSignature] = useState(false);
  const { data: signature } = useSignature();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setSubject(template?.subject ?? "");
    setBodyHtml(template?.bodyHtml ?? "");
    setAppendSignature(template?.appendSignature ?? false);
    setError(null);
  }, [open, template]);

  const previewSubject = useMemo(() => renderMergeFields(subject, PREVIEW_SAMPLE), [subject]);
  // Rendered exactly the way the server will send it: merge fields first,
  // then the plain-text-to-HTML pass, then the signature. What you see here is
  // what lands in the recipient's client.
  const previewBody = useMemo(() => {
    const merged = renderMergeFields(bodyHtml, PREVIEW_SAMPLE);
    const html = plainTextToHtml(merged);
    return appendSignature && signature?.html
      ? `${html}<div style="margin-top:1.5em">${signature.html}</div>`
      : html;
  }, [bodyHtml, appendSignature, signature]);

  const saving = createTemplate.isPending || updateTemplate.isPending;
  const deleting = deleteTemplate.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { name, subject, bodyHtml, appendSignature };
    try {
      if (isEdit && template) {
        await updateTemplate.mutateAsync({ id: template.id, input });
      } else {
        await createTemplate.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save template");
    }
  }

  async function handleDelete() {
    if (!template) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete template");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Editor */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Template name</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cold intro"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Subject</Label>
                <Input
                  id="tpl-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Quick question, {{firstName}}"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-body">Body</Label>
                <Textarea
                  id="tpl-body"
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder="Hi {{firstName}}, noticed {{companyName}} is..."
                  rows={10}
                  className="font-mono text-xs"
                  required
                />
                <p className="text-[10px] text-text-dim">
                  Merge fields: <code>{"{{firstName}}"}</code> <code>{"{{lastName}}"}</code>{" "}
                  <code>{"{{title}}"}</code> <code>{"{{companyName}}"}</code>
                </p>
                <p className="text-[10px] text-text-dim">
                  Line breaks and blank lines are kept when the email goes out — write it the way
                  you want it read.
                </p>
                <label className="flex cursor-pointer items-start gap-2 pt-1">
                  <Checkbox
                    checked={appendSignature}
                    onCheckedChange={(checked) => setAppendSignature(!!checked)}
                    className="mt-0.5"
                  />
                  <span className="text-[11px] leading-snug">
                    Append the sender's signature
                    <span className="block text-[10px] text-text-dim">
                      Each rep's own signature is used, so a shared template signs off correctly.
                      {!signature?.html &&
                        " You haven't set one up yet (Account → Email signature)."}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Live preview */}
            <div className="space-y-1.5">
              <Label>Preview (sample recipient)</Label>
              <div className="rounded-lg border border-border-subtle bg-canvas/40 p-3 space-y-2 h-full">
                <p className="text-[10px] text-text-dim">
                  To: {PREVIEW_SAMPLE.firstName} {PREVIEW_SAMPLE.lastName} · {PREVIEW_SAMPLE.title}{" "}
                  at {PREVIEW_SAMPLE.companyName}
                </p>
                <p className="text-sm font-semibold border-b border-border-subtle pb-2">
                  {previewSubject || <span className="text-text-dim italic">(no subject)</span>}
                </p>
                {previewBody ? (
                  <EmailHtmlPreview html={previewBody} className="h-64" />
                ) : (
                  <p className="text-xs italic text-text-dim">(empty body)</p>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create template"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
