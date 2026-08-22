import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Hash, Lock, Loader2, MessageSquare, Send, Plus, Search, MessagesSquare, Users, UserPlus, Pin } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import {
  useChannels,
  useMessages,
  useCreateChannel,
  useOpenDM,
  useSendMessage,
  useTogglePinMessage,
  useMarkChannelRead,
} from "@/hooks/use-chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChatChannel, UserSummary } from "@/lib/api/types";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});

function ChatPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: channels } = useChannels();
  const { data: users } = useUsers();
  const { data: departments } = useDepartments();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Search and Pinned Filters
  const [chatSearch, setChatSearch] = useState("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // Dialog states
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newDMOpen, setNewDMOpen] = useState(false);

  // New channel form state
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [channelDeptId, setChannelDeptId] = useState<string>("public");

  // Mutations
  const createChannel = useCreateChannel();
  const openDM = useOpenDM();
  const sendMessage = useSendMessage();
  const togglePinMessage = useTogglePinMessage();
  const markChannelRead = useMarkChannelRead();

  const activeChannel = useMemo(() => {
    return channels?.find((c) => c.id === activeChannelId) || null;
  }, [channels, activeChannelId]);

  const { data: messages } = useMessages(activeChannelId || undefined, chatSearch || undefined);

  // Mark the channel read whenever it becomes active (covers both the
  // auto-select-on-load default and manually switching channels) -- this is
  // what makes the sidebar's unread badge actually decrease.
  useEffect(() => {
    if (activeChannelId) {
      markChannelRead.mutate(activeChannelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  // Auto-select first channel on load if none selected
  useEffect(() => {
    if (channels && channels.length > 0 && !activeChannelId) {
      // Find a public general channel or just first non-DM channel
      const defaultChan = channels.find((c) => !c.isDM && c.name === "general") || channels[0];
      setActiveChannelId(defaultChan.id);
    }
  }, [channels, activeChannelId]);

  // Extract channels vs DMs lists
  const channelsList = useMemo(() => {
    return channels?.filter((c) => !c.isDM) || [];
  }, [channels]);

  const dmsList = useMemo(() => {
    return channels?.filter((c) => c.isDM) || [];
  }, [channels]);

  const displayedMessages = useMemo(() => {
    return (messages ?? []).filter((m) => !showPinnedOnly || m.pinnedAt != null);
  }, [messages, showPinnedOnly]);

  // Scroll messages viewport to bottom
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayedMessages]);

  const handleTogglePin = async (messageId: string) => {
    try {
      await togglePinMessage.mutateAsync(messageId);
    } catch (err) {
      console.error("Failed to toggle pin", err);
    }
  };

  // Filter colleague list to exclude self, and filter by search query
  const eligibleColleagues = useMemo(() => {
    if (!users || !currentUser) return [];
    return users.filter(
      (u) =>
        u.id !== currentUser.id &&
        (`${u.firstName} ${u.lastName}`).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, currentUser, searchQuery]);

  // Find the label/name of the DM partner
  const getDMRecipientName = (chan: ChatChannel) => {
    if (!currentUser) return "Colleague";
    const partner = chan.dmUserId1 === currentUser.id ? chan.dmUser2 : chan.dmUser1;
    return partner ? `${partner.firstName} ${partner.lastName}` : "Colleague";
  };

  const getDMRecipientInitials = (chan: ChatChannel) => {
    if (!currentUser) return "C";
    const partner = chan.dmUserId1 === currentUser.id ? chan.dmUser2 : chan.dmUser1;
    if (!partner) return "C";
    return `${partner.firstName[0]}${partner.lastName[0]}`;
  };

  // Submit new public/dept channel
  const handleCreateChannel = async (e: FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    try {
      const formattedName = channelName.trim().toLowerCase().replace(/\s+/g, "-");
      const result = await createChannel.mutateAsync({
        name: formattedName,
        description: channelDescription.trim() || undefined,
        departmentId: channelDeptId === "public" ? undefined : channelDeptId,
      });
      setChannelName("");
      setChannelDescription("");
      setChannelDeptId("public");
      setNewChannelOpen(false);
      setActiveChannelId(result.id);
    } catch (err) {
      console.error("Failed to create channel", err);
    }
  };

  // Start new DM with colleague
  const handleStartDM = async (recipientId: string) => {
    try {
      const result = await openDM.mutateAsync(recipientId);
      setSearchQuery("");
      setNewDMOpen(false);
      setActiveChannelId(result.id);
    } catch (err) {
      console.error("Failed to open DM channel", err);
    }
  };

  // Send message
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChannelId) return;

    const content = messageText.trim();
    setMessageText("");

    try {
      await sendMessage.mutateAsync({
        channelId: activeChannelId,
        content,
      });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* LEFT SIDEBAR: Channels & DMs list */}
      <div className="w-64 border-r border-border-subtle bg-panel flex flex-col shrink-0 select-none">
        {/* Header / New chat trigger */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessagesSquare className="size-5 text-primary" />
            <span className="font-semibold text-sm tracking-tight">Team Channels</span>
          </div>
        </div>

        {/* Channels/DMs Navigation */}
        <ScrollArea className="flex-1 px-3 py-2 space-y-4">
          {/* CHANNELS SECTION */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-text-dim uppercase tracking-wider">
              <span>Channels</span>
              <button
                onClick={() => setNewChannelOpen(true)}
                className="p-0.5 rounded hover:bg-panel-elevated text-text-dim hover:text-primary transition-colors"
                title="Create Channel"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {channelsList.map((c) => {
              const isActive = c.id === activeChannelId;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-text-dim hover:bg-panel-elevated hover:text-text"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {c.departmentId ? (
                      <Lock className="size-3.5 shrink-0" />
                    ) : (
                      <Hash className="size-3.5 shrink-0" />
                    )}
                    <span className="truncate">{c.name}</span>
                  </div>
                  {c.department && !isActive && (
                    <span className="text-[8px] bg-panel-elevated px-1 py-0.5 rounded text-primary font-mono scale-90">
                      {c.department.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* DIRECT MESSAGES SECTION */}
          <div className="space-y-1 pt-4">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-text-dim uppercase tracking-wider">
              <span>Direct Messages</span>
              <button
                onClick={() => setNewDMOpen(true)}
                className="p-0.5 rounded hover:bg-panel-elevated text-text-dim hover:text-primary transition-colors"
                title="New Direct Message"
              >
                <UserPlus className="size-3.5" />
              </button>
            </div>
            {dmsList.map((c) => {
              const isActive = c.id === activeChannelId;
              const name = getDMRecipientName(c);
              const initials = getDMRecipientInitials(c);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-text-dim hover:bg-panel-elevated hover:text-text"
                  }`}
                >
                  <Avatar className="size-4 shrink-0 bg-primary/20">
                    <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* CHAT WINDOW (Middle viewport) */}
      {activeChannel ? (
        <div className="flex-1 flex flex-col bg-background">
          {/* Active Channel Header */}
          <div className="h-14 px-6 border-b border-border-subtle flex items-center justify-between select-none bg-panel shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                {activeChannel.isDM ? (
                  <MessageSquare className="size-4 text-primary" />
                ) : activeChannel.departmentId ? (
                  <Lock className="size-4 text-primary" />
                ) : (
                  <Hash className="size-4 text-primary" />
                )}
                <span className="font-semibold text-sm">
                  {activeChannel.isDM ? getDMRecipientName(activeChannel) : activeChannel.name}
                </span>
              </div>
              {!activeChannel.isDM && activeChannel.description && (
                <p className="text-[10px] text-text-dim mt-0.5 truncate max-w-[250px]">
                  {activeChannel.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-40">
                <Search className="absolute left-2.5 top-2.5 size-3 text-text-dim" />
                <Input
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="pl-8 bg-background text-[10px] h-8 w-full"
                />
              </div>
              <button
                onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                className={`p-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-all ${
                  showPinnedOnly
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-500 font-bold"
                    : "bg-background border-border text-text-dim hover:text-text"
                }`}
                title="Toggle Pinned Messages"
              >
                <Pin className="size-3.5" />
                {showPinnedOnly ? "Show All" : "Pinned Only"}
              </button>
            </div>
          </div>

          {/* Message Stream */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              {displayedMessages && displayedMessages.length > 0 ? (
                displayedMessages.map((m) => {
                  const isOwn = m.senderId === currentUser?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 max-w-[80%] group ${
                        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
                      }`}
                    >
                      <Avatar className="size-7 bg-primary/10 border border-primary/20 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {m.sender.firstName[0]}
                          {m.sender.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className={`flex items-center gap-2 text-[10px] text-text-dim ${
                          isOwn ? "justify-end" : ""
                        }`}>
                          {m.pinnedAt && <Pin className="size-2.5 text-amber-500 fill-amber-500 shrink-0" aria-label="Pinned message" />}
                          <span className="font-semibold text-text">
                            {m.sender.firstName} {m.sender.lastName}
                          </span>
                          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                              isOwn
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-panel border border-border-subtle rounded-tl-none text-text"
                            }`}
                          >
                            {m.content}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTogglePin(m.id)}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-panel-elevated shrink-0 ${
                              m.pinnedAt ? "text-amber-500 opacity-100" : "text-text-dim hover:text-amber-500"
                            }`}
                            title={m.pinnedAt ? "Unpin message" : "Pin message"}
                          >
                            <Pin className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                  <MessagesSquare className="size-8 text-primary/30" />
                  <p className="text-xs font-semibold text-text-dim">No messages in this chat yet</p>
                  <p className="text-[10px] text-text-dim max-w-[250px]">
                    Send a message to start the conversation!
                  </p>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Message Input Box */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-border-subtle bg-panel flex gap-2">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={
                activeChannel.isDM
                  ? `Message ${getDMRecipientName(activeChannel)}...`
                  : `Message #${activeChannel.name}...`
              }
              className="flex-1 bg-background text-xs"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={!messageText.trim()} className="shrink-0">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-background">
          <MessagesSquare className="size-12 text-primary/20 animate-pulse" />
          <h2 className="text-sm font-semibold text-text mt-4">Welcome to Team Chat</h2>
          <p className="text-xs text-text-dim max-w-sm mt-1.5">
            Select a channel or message a colleague from the sidebar to begin communicating.
          </p>
        </div>
      )}

      {/* DIALOG: Create Channel */}
      <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Chat Channel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateChannel} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="chan-name">Channel Name</Label>
              <Input
                id="chan-name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. general-chatter"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chan-description">Description (optional)</Label>
              <Input
                id="chan-description"
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
                placeholder="e.g. Quick team syncing & announcements"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department Scope</Label>
              <Select value={channelDeptId} onValueChange={setChannelDeptId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (All Departments)</SelectItem>
                  {currentUser?.role.name === "ADMIN"
                    ? departments?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          Only {d.name} members
                        </SelectItem>
                      ))
                    : currentUser?.department && (
                        <SelectItem value={currentUser.department.id}>
                          Only {currentUser.department.name} members
                        </SelectItem>
                      )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-text-dim">
                Restricting to a department makes the channel visible only to employees within that department.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewChannelOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createChannel.isPending}>
                {createChannel.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Create Channel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: New Direct Message */}
      <Dialog open={newDMOpen} onOpenChange={setNewDMOpen}>
        <DialogContent className="sm:max-w-md flex flex-col h-[400px]">
          <DialogHeader>
            <DialogTitle>New Direct Message</DialogTitle>
          </DialogHeader>
          <div className="relative my-2 shrink-0">
            <Search className="absolute left-2.5 top-2.5 size-4 text-text-dim" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search colleague by name..."
              className="pl-9 text-xs"
              autoFocus
            />
          </div>
          <ScrollArea className="flex-1 border border-border-subtle rounded-lg p-2 bg-panel-elevated">
            <div className="space-y-1">
              {eligibleColleagues.length > 0 ? (
                eligibleColleagues.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleStartDM(u.id)}
                    className="w-full text-left p-2 rounded-lg hover:bg-panel hover:text-primary transition-all flex items-center justify-between text-xs font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-5 bg-primary/10">
                        <AvatarFallback className="text-[8px]">
                          {u.firstName[0]}
                          {u.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {u.firstName} {u.lastName}
                      </span>
                    </div>
                    {u.department && (
                      <span className="text-[8px] bg-panel px-1.5 py-0.5 rounded text-text-dim">
                        {u.department.name}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center text-xs text-text-dim py-8">
                  No other colleagues found matching query.
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
