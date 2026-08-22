import { apiFetch } from "./client";
import { UserSummary, Department } from "./types";

export interface SeoKeyword {
  id: string;
  term: string;
  volume: number;
  difficulty: number;
  currentRank: number | null;
  targetRank: number | null;
  url: string | null;
  projectId: string | null;
  departmentId: string;
  department?: Department;
  createdAt: string;
  updatedAt: string;
}

export interface SeoCompetitor {
  id: string;
  domain: string;
  da: number;
  traffic: number;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeoAudit {
  id: string;
  url: string;
  score: number;
  issues: string; // JSON string
  departmentId: string;
  department?: Department;
  runAt: string;
}

export type BacklinkStatus = "ACTIVE" | "LOST";

export interface SeoBacklink {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  domainAuthority: number;
  status: BacklinkStatus;
  departmentId: string;
  department?: Department;
  createdAt: string;
  updatedAt: string;
}

export type ContentBriefStatus = "DRAFT" | "IN_PROGRESS" | "REVIEW" | "PUBLISHED";

export interface SeoContentBrief {
  id: string;
  title: string;
  targetKeyword: string;
  status: ContentBriefStatus;
  dueDate: string | null;
  assigneeId: string | null;
  assignee?: UserSummary;
  content: string | null;
  departmentId: string;
  department?: Department;
  createdAt: string;
  updatedAt: string;
}

// Keyword endpoints
export function getKeywords(departmentId?: string): Promise<SeoKeyword[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoKeyword[]>(`/seo-keywords${params}`);
}

export function createKeyword(keyword: Partial<SeoKeyword>): Promise<SeoKeyword> {
  return apiFetch<SeoKeyword>("/seo-keywords", {
    method: "POST",
    body: JSON.stringify(keyword),
  });
}

// Audit endpoints
export function getAudits(departmentId?: string): Promise<SeoAudit[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoAudit[]>(`/seo-audits${params}`);
}

export function createAudit(audit: Partial<SeoAudit>): Promise<SeoAudit> {
  return apiFetch<SeoAudit>("/seo-audits", {
    method: "POST",
    body: JSON.stringify(audit),
  });
}

// Backlink endpoints
export function getBacklinks(departmentId?: string): Promise<SeoBacklink[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoBacklink[]>(`/seo-backlinks${params}`);
}

export function createBacklink(backlink: Partial<SeoBacklink>): Promise<SeoBacklink> {
  return apiFetch<SeoBacklink>("/seo-backlinks", {
    method: "POST",
    body: JSON.stringify(backlink),
  });
}

// Content Brief endpoints
export function getContentBriefs(departmentId?: string): Promise<SeoContentBrief[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoContentBrief[]>(`/seo-content-briefs${params}`);
}

export function createContentBrief(brief: Partial<SeoContentBrief>): Promise<SeoContentBrief> {
  return apiFetch<SeoContentBrief>("/seo-content-briefs", {
    method: "POST",
    body: JSON.stringify(brief),
  });
}

export function updateContentBrief(id: string, brief: Partial<SeoContentBrief>): Promise<SeoContentBrief> {
  return apiFetch<SeoContentBrief>(`/seo-content-briefs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(brief),
  });
}

export function generateContentBrief(id: string): Promise<SeoContentBrief> {
  return apiFetch<SeoContentBrief>(`/seo-content-briefs/${id}/generate`, {
    method: "POST",
  });
}

// Competitors endpoints
export function getCompetitors(departmentId?: string): Promise<SeoCompetitor[]> {
  const params = departmentId ? `?departmentId=${departmentId}` : "";
  return apiFetch<SeoCompetitor[]>(`/seo-competitors${params}`);
}

export function createCompetitor(competitor: Partial<SeoCompetitor>): Promise<SeoCompetitor> {
  return apiFetch<SeoCompetitor>("/seo-competitors", {
    method: "POST",
    body: JSON.stringify(competitor),
  });
}
