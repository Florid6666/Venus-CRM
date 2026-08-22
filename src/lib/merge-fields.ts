// Mirrors server/src/common/utils/merge-fields.ts -- kept in sync manually
// since server/ is a standalone package, not shared with the frontend.
// Used for the Templates live preview only; the real send (once Sequences
// exist) renders server-side against the actual Contact.
export interface MergeFieldSample {
  firstName: string;
  lastName: string;
  title?: string;
  companyName?: string;
}

export function renderMergeFields(template: string, sample: MergeFieldSample): string {
  const values: Record<string, string> = {
    firstName: sample.firstName,
    lastName: sample.lastName,
    title: sample.title ?? "",
    companyName: sample.companyName ?? "",
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}
