import { apiFetch } from "./client";
import type { PersonRef } from "./types";

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
export type JobPostingStatus = "OPEN" | "ON_HOLD" | "CLOSED" | "FILLED";
export type CandidateStage = "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
export type InterviewType = "PHONE_SCREEN" | "TECHNICAL" | "BEHAVIORAL" | "ONSITE" | "FINAL";
export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
export type OfferStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "RESCINDED";

export const EMPLOYMENT_TYPES: EmploymentType[] = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"];
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

export const JOB_POSTING_STATUSES: JobPostingStatus[] = ["OPEN", "ON_HOLD", "CLOSED", "FILLED"];
export const JOB_POSTING_STATUS_LABELS: Record<JobPostingStatus, string> = {
  OPEN: "Open",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
  FILLED: "Filled",
};

export const CANDIDATE_STAGES: CandidateStage[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
];
export const CANDIDATE_STAGE_LABELS: Record<CandidateStage, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export const INTERVIEW_TYPES: InterviewType[] = ["PHONE_SCREEN", "TECHNICAL", "BEHAVIORAL", "ONSITE", "FINAL"];
export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE_SCREEN: "Phone screen",
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  ONSITE: "Onsite",
  FINAL: "Final",
};

export const INTERVIEW_STATUSES: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELED", "NO_SHOW"];
export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  NO_SHOW: "No-show",
};

export const OFFER_STATUSES: OfferStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "RESCINDED"];
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  RESCINDED: "Rescinded",
};

export interface JobPosting {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  employmentType: EmploymentType;
  status: JobPostingStatus;
  hiringDepartmentId: string | null;
  hiringDepartment: { id: string; name: string } | null;
  departmentId: string | null;
  ownerId: string;
  owner: PersonRef;
  _count: { candidates: number };
  createdAt: string;
  updatedAt: string;
}

export interface CandidateJobPostingRef {
  id: string;
  title: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  resumeUrl: string | null;
  source: string | null;
  stage: CandidateStage;
  position: number;
  rejectionReason: string | null;
  jobPostingId: string;
  jobPosting: CandidateJobPostingRef;
  ownerId: string;
  owner: PersonRef;
  departmentId: string | null;
  appliedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateDetail extends Candidate {
  interviews: Interview[];
  offers: Offer[];
}

export interface Interview {
  id: string;
  candidateId: string;
  candidate: { id: string; firstName: string; lastName: string; jobPostingId: string };
  interviewerId: string | null;
  interviewer: PersonRef | null;
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  type: InterviewType;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  status: InterviewStatus;
  feedback: string | null;
  rating: number | null;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  candidateId: string;
  candidate: { id: string; firstName: string; lastName: string; jobPostingId: string };
  createdById: string;
  createdBy: Pick<PersonRef, "id" | "firstName" | "lastName">;
  salary: number;
  startDate: string | null;
  status: OfferStatus;
  sentAt: string | null;
  respondedAt: string | null;
  notes: string | null;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentAnalyticsSummary {
  openPositions: number;
  totalCandidates: number;
  stageCounts: Record<CandidateStage, number>;
  hiresThisMonth: number;
  avgTimeToHireDays: number | null;
  offerCounts: Record<OfferStatus, number>;
  offerAcceptanceRate: number | null;
  upcomingInterviews: number;
  openPositionsByDepartment: { departmentId: string | null; departmentName: string; count: number }[];
}

// --- Job Postings ---

export interface JobPostingFilters {
  status?: JobPostingStatus;
  hiringDepartmentId?: string;
  departmentId?: string;
}

export interface CreateJobPostingInput {
  title: string;
  description?: string;
  location?: string;
  employmentType?: EmploymentType;
  status?: JobPostingStatus;
  hiringDepartmentId?: string;
  ownerId?: string;
  departmentId?: string;
}

export type UpdateJobPostingInput = Partial<CreateJobPostingInput>;

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function listJobPostings(filters: JobPostingFilters = {}) {
  return apiFetch<JobPosting[]>(`/job-postings${buildQuery({ ...filters })}`);
}

export function getJobPosting(id: string) {
  return apiFetch<JobPosting>(`/job-postings/${id}`);
}

export function createJobPosting(input: CreateJobPostingInput) {
  return apiFetch<JobPosting>("/job-postings", { method: "POST", body: JSON.stringify(input) });
}

export function updateJobPosting(id: string, input: UpdateJobPostingInput) {
  return apiFetch<JobPosting>(`/job-postings/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function closeJobPosting(id: string) {
  return apiFetch<JobPosting>(`/job-postings/${id}`, { method: "DELETE" });
}

// --- Candidates ---

export interface CandidateFilters {
  jobPostingId?: string;
  stage?: CandidateStage;
  ownerId?: string;
  mine?: boolean;
  departmentId?: string;
}

export interface CreateCandidateInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  resumeUrl?: string;
  source?: string;
  stage?: CandidateStage;
  position?: number;
  rejectionReason?: string;
  jobPostingId: string;
  ownerId?: string;
  departmentId?: string;
}

export type UpdateCandidateInput = Partial<Omit<CreateCandidateInput, "jobPostingId" | "departmentId">>;

export function listCandidates(filters: CandidateFilters = {}) {
  const qs = buildQuery({
    jobPostingId: filters.jobPostingId,
    stage: filters.stage,
    ownerId: filters.ownerId,
    departmentId: filters.departmentId,
    mine: filters.mine ? "true" : undefined,
  });
  return apiFetch<Candidate[]>(`/candidates${qs}`);
}

export function getCandidate(id: string) {
  return apiFetch<CandidateDetail>(`/candidates/${id}`);
}

export function createCandidate(input: CreateCandidateInput) {
  return apiFetch<Candidate>("/candidates", { method: "POST", body: JSON.stringify(input) });
}

export function updateCandidate(id: string, input: UpdateCandidateInput) {
  return apiFetch<Candidate>(`/candidates/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteCandidate(id: string) {
  return apiFetch<void>(`/candidates/${id}`, { method: "DELETE" });
}

// --- Interviews ---

export interface InterviewFilters {
  candidateId?: string;
  interviewerId?: string;
  status?: InterviewStatus;
  mine?: boolean;
  upcoming?: boolean;
}

export interface CreateInterviewInput {
  candidateId: string;
  interviewerId?: string;
  type?: InterviewType;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
}

export interface UpdateInterviewInput extends Partial<Omit<CreateInterviewInput, "candidateId">> {
  status?: InterviewStatus;
  feedback?: string;
  rating?: number;
}

export function listInterviews(filters: InterviewFilters = {}) {
  const qs = buildQuery({
    candidateId: filters.candidateId,
    interviewerId: filters.interviewerId,
    status: filters.status,
    mine: filters.mine ? "true" : undefined,
    upcoming: filters.upcoming ? "true" : undefined,
  });
  return apiFetch<Interview[]>(`/interviews${qs}`);
}

export function createInterview(input: CreateInterviewInput) {
  return apiFetch<Interview>("/interviews", { method: "POST", body: JSON.stringify(input) });
}

export function updateInterview(id: string, input: UpdateInterviewInput) {
  return apiFetch<Interview>(`/interviews/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteInterview(id: string) {
  return apiFetch<void>(`/interviews/${id}`, { method: "DELETE" });
}

// --- Offers ---

export interface OfferFilters {
  candidateId?: string;
  status?: OfferStatus;
  departmentId?: string;
}

export interface CreateOfferInput {
  candidateId: string;
  salary: number;
  startDate?: string;
  status?: OfferStatus;
  notes?: string;
}

export type UpdateOfferInput = Partial<Omit<CreateOfferInput, "candidateId">>;

export function listOffers(filters: OfferFilters = {}) {
  return apiFetch<Offer[]>(`/offers${buildQuery({ ...filters })}`);
}

export function createOffer(input: CreateOfferInput) {
  return apiFetch<Offer>("/offers", { method: "POST", body: JSON.stringify(input) });
}

export function updateOffer(id: string, input: UpdateOfferInput) {
  return apiFetch<Offer>(`/offers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteOffer(id: string) {
  return apiFetch<void>(`/offers/${id}`, { method: "DELETE" });
}

// --- Analytics ---

export function getRecruitmentAnalyticsSummary() {
  return apiFetch<RecruitmentAnalyticsSummary>("/recruitment-analytics/summary");
}
