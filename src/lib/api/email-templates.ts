import { apiFetch } from "./client";
import type { EmailTemplate } from "./types";

export interface CreateEmailTemplateInput {
  name: string;
  subject: string;
  bodyHtml: string;
  appendSignature?: boolean;
}

export type UpdateEmailTemplateInput = Partial<CreateEmailTemplateInput>;

export function listEmailTemplates() {
  return apiFetch<EmailTemplate[]>("/email-templates");
}

export function getEmailTemplate(id: string) {
  return apiFetch<EmailTemplate>(`/email-templates/${id}`);
}

export function createEmailTemplate(input: CreateEmailTemplateInput) {
  return apiFetch<EmailTemplate>("/email-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateEmailTemplate(id: string, input: UpdateEmailTemplateInput) {
  return apiFetch<EmailTemplate>(`/email-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteEmailTemplate(id: string) {
  return apiFetch<EmailTemplate>(`/email-templates/${id}`, { method: "DELETE" });
}
