// Renders {{firstName}} {{lastName}} {{title}} {{companyName}} placeholders
// in an EmailTemplate's subject/bodyHtml against a real Contact. Shared by
// the Templates preview and (once built) the Sequence send engine, so both
// paths render identically. Unknown/blank fields resolve to "" rather than
// leaving the raw placeholder in the sent email.
export interface MergeFieldSource {
  firstName: string;
  lastName: string;
  title?: string | null;
  companyName?: string | null;
}

export function renderMergeFields(template: string, contact: MergeFieldSource): string {
  const values: Record<string, string> = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    title: contact.title ?? "",
    companyName: contact.companyName ?? "",
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}
