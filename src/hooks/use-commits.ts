import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCommits, createCommit, mergePR, declinePR, type CreateCommitInput } from "@/lib/api/commits";

export function useCommits() {
  return useQuery({
    queryKey: ["commits"],
    queryFn: listCommits,
    refetchInterval: 5000, // Fetch recent commits every 5s
  });
}

export function useCreateCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommitInput) => createCommit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export function useMergePR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mergePR(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commits"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export function useDeclinePR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => declinePR(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commits"] });
    },
  });
}
