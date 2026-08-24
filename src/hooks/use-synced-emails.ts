import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSyncedEmails,
  markSyncedEmailRead,
  type SyncedEmailFilters,
} from "@/lib/api/synced-emails";

export function useSyncedEmails(filters: SyncedEmailFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["synced-emails", filters],
    queryFn: () => listSyncedEmails(filters),
    enabled,
  });
}

export function useMarkSyncedEmailRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markSyncedEmailRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["synced-emails"] }),
  });
}
