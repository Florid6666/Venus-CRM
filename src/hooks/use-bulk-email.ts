import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listBulkEmailCampaigns,
  getBulkEmailCampaign,
  createBulkEmailCampaign,
  runBulkEmailEngine,
  listFollowUps,
  type CreateBulkEmailInput,
} from "@/lib/api/bulk-email";

const BULK_EMAIL_KEY = ["bulk-email"] as const;

export function useBulkEmailCampaigns() {
  return useQuery({ queryKey: BULK_EMAIL_KEY, queryFn: listBulkEmailCampaigns });
}

export function useBulkEmailCampaign(id: string | undefined) {
  return useQuery({
    queryKey: [...BULK_EMAIL_KEY, "detail", id],
    queryFn: () => getBulkEmailCampaign(id as string),
    enabled: !!id,
  });
}

function useInvalidateBulkEmail() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: BULK_EMAIL_KEY });
    if (id) qc.invalidateQueries({ queryKey: [...BULK_EMAIL_KEY, "detail", id] });
  };
}

export function useCreateBulkEmailCampaign() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: (input: CreateBulkEmailInput) => createBulkEmailCampaign(input),
    onSuccess: () => invalidate(),
  });
}

export function useRunBulkEmailEngine() {
  const invalidate = useInvalidateBulkEmail();
  return useMutation({
    mutationFn: () => runBulkEmailEngine(),
    onSuccess: () => invalidate(),
  });
}

export function useFollowUps() {
  return useQuery({
    queryKey: [...BULK_EMAIL_KEY, "follow-ups"],
    queryFn: listFollowUps,
  });
}
