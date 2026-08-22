import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listWorkSessions,
  getActiveWorkSession,
  clockIn,
  clockOut,
} from "@/lib/api/work-sessions";

export const WORK_SESSIONS_KEY = ["work-sessions"] as const;
export const ACTIVE_SESSION_KEY = ["work-sessions", "active"] as const;

export function useWorkSessions(userId?: string) {
  return useQuery({
    queryKey: [...WORK_SESSIONS_KEY, userId],
    queryFn: () => listWorkSessions(userId),
  });
}

export function useActiveWorkSession() {
  return useQuery({
    queryKey: ACTIVE_SESSION_KEY,
    queryFn: getActiveWorkSession,
    // Slightly faster polling to ensure clock accuracy isn't lost if another tab clocks out
    refetchInterval: 60000,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clockIn,
    onSuccess: (session) => {
      qc.setQueryData(ACTIVE_SESSION_KEY, session);
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clockOut,
    onSuccess: () => {
      qc.setQueryData(ACTIVE_SESSION_KEY, null);
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}
