import { apiFetch } from "./client";
import type { ChatChannel, ChatMessage } from "./types";

export interface CreateChannelInput {
  name: string;
  description?: string;
  departmentId?: string;
}

export function listChannels() {
  return apiFetch<ChatChannel[]>("/chat/channels");
}

export function createChannel(input: CreateChannelInput) {
  return apiFetch<ChatChannel>("/chat/channels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function openDM(recipientId: string) {
  return apiFetch<ChatChannel>("/chat/dms", {
    method: "POST",
    body: JSON.stringify({ recipientId }),
  });
}

export function listMessages(channelId: string, q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<ChatMessage[]>(`/chat/channels/${channelId}/messages${query}`);
}

export function sendMessage(channelId: string, content: string) {
  return apiFetch<ChatMessage>(`/chat/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function togglePinMessage(messageId: string) {
  return apiFetch<ChatMessage>(`/chat/messages/${messageId}/pin`, {
    method: "PATCH",
  });
}

export function getUnreadCount() {
  return apiFetch<{ count: number }>("/chat/unread-count");
}

export function markChannelRead(channelId: string) {
  return apiFetch<void>(`/chat/channels/${channelId}/read`, { method: "POST" });
}
