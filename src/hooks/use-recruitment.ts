import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/recruitment";

// --- Job Postings ---

export function useJobPostings(filters: api.JobPostingFilters = {}, enabled = true) {
  return useQuery({ queryKey: ["job-postings", filters], queryFn: () => api.listJobPostings(filters), enabled });
}

export function useJobPosting(id: string | undefined) {
  return useQuery({
    queryKey: ["job-postings", "detail", id],
    queryFn: () => api.getJobPosting(id!),
    enabled: !!id,
  });
}

function useInvalidateJobPostings() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["job-postings"] });
    queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
  };
}

export function useCreateJobPosting() {
  const invalidate = useInvalidateJobPostings();
  return useMutation({
    mutationFn: (input: api.CreateJobPostingInput) => api.createJobPosting(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateJobPosting() {
  const invalidate = useInvalidateJobPostings();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateJobPostingInput }) => api.updateJobPosting(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useCloseJobPosting() {
  const invalidate = useInvalidateJobPostings();
  return useMutation({
    mutationFn: (id: string) => api.closeJobPosting(id),
    onSuccess: () => invalidate(),
  });
}

// --- Candidates ---

export function useCandidates(filters: api.CandidateFilters = {}, enabled = true) {
  return useQuery({ queryKey: ["candidates", filters], queryFn: () => api.listCandidates(filters), enabled });
}

export function useCandidate(id: string | undefined) {
  return useQuery({
    queryKey: ["candidates", "detail", id],
    queryFn: () => api.getCandidate(id!),
    enabled: !!id,
  });
}

function useInvalidateCandidates() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    queryClient.invalidateQueries({ queryKey: ["job-postings"] });
    queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
  };
}

export function useCreateCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: (input: api.CreateCandidateInput) => api.createCandidate(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateCandidateInput }) => api.updateCandidate(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCandidate() {
  const invalidate = useInvalidateCandidates();
  return useMutation({
    mutationFn: (id: string) => api.deleteCandidate(id),
    onSuccess: () => invalidate(),
  });
}

// --- Interviews ---

export function useInterviews(filters: api.InterviewFilters = {}) {
  return useQuery({ queryKey: ["interviews", filters], queryFn: () => api.listInterviews(filters) });
}

function useInvalidateInterviews() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["interviews"] });
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
  };
}

export function useCreateInterview() {
  const invalidate = useInvalidateInterviews();
  return useMutation({
    mutationFn: (input: api.CreateInterviewInput) => api.createInterview(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateInterview() {
  const invalidate = useInvalidateInterviews();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateInterviewInput }) => api.updateInterview(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteInterview() {
  const invalidate = useInvalidateInterviews();
  return useMutation({
    mutationFn: (id: string) => api.deleteInterview(id),
    onSuccess: () => invalidate(),
  });
}

// --- Offers ---

export function useOffers(filters: api.OfferFilters = {}) {
  return useQuery({ queryKey: ["offers", filters], queryFn: () => api.listOffers(filters) });
}

function useInvalidateOffers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    queryClient.invalidateQueries({ queryKey: ["recruitment-analytics"] });
  };
}

export function useCreateOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (input: api.CreateOfferInput) => api.createOffer(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateOfferInput }) => api.updateOffer(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (id: string) => api.deleteOffer(id),
    onSuccess: () => invalidate(),
  });
}

// --- Analytics ---

export function useRecruitmentAnalyticsSummary(enabled = true) {
  return useQuery({
    queryKey: ["recruitment-analytics", "summary"],
    queryFn: api.getRecruitmentAnalyticsSummary,
    enabled,
  });
}
