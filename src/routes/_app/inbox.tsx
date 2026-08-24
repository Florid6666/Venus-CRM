import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Mail, ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useEmailConnectionStatus } from "@/hooks/use-email-connections";
import { useSyncedEmails, useMarkSyncedEmailRead } from "@/hooks/use-synced-emails";
import type { SyncedEmail } from "@/lib/api/types";

const CONNECTION_TYPE_LABEL: Record<string, string> = {
  OAUTH_GOOGLE: "Google",
  OAUTH_MICROSOFT: "Microsoft",
};

export const Route = createFileRoute("/_app/inbox")({
  component: InboxPage,
});

function InboxPage() {
  useDepartmentGuard("Sales");

  const { data: status, isLoading: statusLoading } = useEmailConnectionStatus();
  const { data: messages, isLoading: messagesLoading } = useSyncedEmails();
  const markRead = useMarkSyncedEmailRead();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => messages?.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId],
  );

  function openMessage(message: SyncedEmail) {
    setSelectedId(message.id);
    if (!message.isRead) {
      markRead.mutate(message.id);
    }
  }

  const oauthConnected = status?.connected && status.connectionType !== "SMTP";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-text-dim" />
        <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
      </div>

      {!statusLoading && !oauthConnected && (
        <div className="bg-panel border border-border-subtle rounded-xl p-6 text-sm text-text-dim">
          Connect your mailbox with Google or Outlook from{" "}
          <a href="/account" className="text-primary hover:underline">
            My Account
          </a>{" "}
          to see your sent and received mail here. (An SMTP-only connection can send but can't sync
          -- switch to Google/Outlook connect for that.)
        </div>
      )}

      {oauthConnected && (
        <div className="grid md:grid-cols-[340px_1fr] gap-4">
          <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
              <p className="text-xs font-medium text-text-dim">
                {status?.connectionType ? CONNECTION_TYPE_LABEL[status.connectionType] : ""} ·{" "}
                {status?.providerAccountEmail}
              </p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-border-subtle">
              {messagesLoading && (
                <div className="flex items-center gap-2 text-sm text-text-dim p-4">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              )}
              {!messagesLoading && (messages ?? []).length === 0 && (
                <p className="text-sm text-text-dim p-4">
                  Nothing synced yet -- this fills in automatically within a few minutes of
                  connecting.
                </p>
              )}
              {(messages ?? []).map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => openMessage(message)}
                  className={`w-full text-left px-4 py-3 hover:bg-canvas/50 transition-colors ${
                    selectedId === message.id ? "bg-canvas/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-text-dim mb-0.5">
                    {message.direction === "SENT" ? (
                      <ArrowUpRight className="size-3 text-primary" />
                    ) : (
                      <ArrowDownLeft className="size-3 text-cyan-400" />
                    )}
                    {new Date(message.occurredAt).toLocaleString()}
                  </div>
                  <p
                    className={`text-xs truncate ${message.isRead ? "text-text-dim" : "font-semibold"}`}
                  >
                    {message.direction === "SENT"
                      ? message.toAddresses.join(", ")
                      : message.fromAddress}
                  </p>
                  <p className="text-xs truncate mt-0.5">{message.subject || "(no subject)"}</p>
                  <p className="text-[11px] text-text-dim truncate">{message.bodyPreview}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-panel border border-border-subtle rounded-xl p-6">
            {!selected ? (
              <p className="text-sm text-text-dim">Select a message to read it.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">{selected.subject || "(no subject)"}</h2>
                  <p className="text-xs text-text-dim mt-1">
                    {selected.direction === "SENT" ? "To" : "From"}:{" "}
                    {selected.direction === "SENT"
                      ? selected.toAddresses.join(", ")
                      : selected.fromAddress}
                  </p>
                  {selected.ccAddresses.length > 0 && (
                    <p className="text-xs text-text-dim">Cc: {selected.ccAddresses.join(", ")}</p>
                  )}
                  <p className="text-xs text-text-dim">
                    {new Date(selected.occurredAt).toLocaleString()}
                  </p>
                </div>
                {/* bodyPreview is the provider's own plain-text snippet -- safe
                    to render directly. Full HTML bodies aren't synced (see
                    EmailSyncEngineService): rendering a received email's raw
                    HTML would need real sanitization first (a sender fully
                    controls that markup), which v1 doesn't attempt. */}
                <p className="text-sm whitespace-pre-wrap">{selected.bodyPreview}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
