import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listChannels,
  createChannel,
  openDM,
  listMessages,
  sendMessage,
  togglePinMessage,
  getUnreadCount,
  markChannelRead,
  type CreateChannelInput,
} from "@/lib/api/chat";

export function useChannels() {
  return useQuery({
    queryKey: ["chat", "channels"],
    queryFn: listChannels,
    refetchInterval: 5000, // Refresh channels list every 5s
  });
}

// Backs the sidebar's Team Chat badge -- polled independently of whether
// the chat page itself is open.
export function useChatUnreadCount() {
  return useQuery({
    queryKey: ["chat", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 15000,
  });
}

export function useMarkChannelRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => markChannelRead(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "unread-count"] });
    },
  });
}

export function useMessages(channelId: string | undefined, searchQuery?: string) {
  return useQuery({
    queryKey: ["chat", "messages", channelId, { q: searchQuery }],
    queryFn: () => listMessages(channelId!, searchQuery),
    enabled: !!channelId,
    refetchInterval: searchQuery ? false : 3000, // Pause polling during active search for stable typing UX
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChannelInput) => createChannel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    },
  });
}

export function useOpenDM() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipientId: string) => openDM(recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, content }: { channelId: string; content: string }) =>
      sendMessage(channelId, content),
    onSuccess: (data, variables) => {
      // Optimistically invalidate messages for the active channel
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", variables.channelId] });
      // Invalidate channels list to update the order (recently active first)
      queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    },
  });
}

export function useTogglePinMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => togglePinMessage(messageId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", data.channelId] });
    },
  });
}
