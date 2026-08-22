import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "@/lib/api/notifications";

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: listNotifications,
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadCount,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}
