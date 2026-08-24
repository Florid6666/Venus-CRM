import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useCallStore, type IncomingCall } from "@/stores/call-store";
import { canUseCalling } from "@/lib/telephony/access";
import {
  useCreateCall,
  useJustCallConnection,
  useLinkProviderCallId,
  useLookupCallerByPhone,
} from "@/hooks/use-telephony";
import {
  DIALER_CONTAINER_ID,
  getOrCreateDialer,
  getLoginState,
} from "@/lib/telephony/justcall-dialer";
import { CallDispositionForm } from "./call-disposition-form";
import { UnknownCallerPrompt } from "./unknown-caller-prompt";
import { cn } from "@/lib/utils";
import type {
  CallEndedEventData,
  CallRingingEventData,
  LoggedInEventData,
} from "@justcall/justcall-dialer-sdk";

// Mounted once in the app shell (see _app.tsx, alongside CommandPalette and
// GlobalDialogs) so it survives route navigation -- CallButton anywhere in
// the app just pushes a target into useCallStore.
//
// The dialer container div below is ALWAYS rendered (never conditionally
// unmounted) so the underlying JustCallDialer/iframe instance -- and the
// agent's JustCall login session inside it -- survives the widget being
// closed between calls. Only its visibility toggles.
//
// Mute/Hold/End controls are deliberately NOT built here: the JustCall
// Dialer SDK's iframe (365x610px, see the SDK's README) already contains
// JustCall's own in-call controls. Rebuilding them would either be
// non-functional (the SDK exposes no muteCall()/holdCall()/hangupCall()
// methods to call into) or duplicate UI the agent already sees inside the
// embedded dialer.
//
// Inbound calls (§9/§10): the SDK's call-ringing fires in every logged-in
// agent's browser regardless of who the call is for -- there's no separate
// provider push to subscribe to. When it fires with direction "inbound",
// this widget resolves the caller (useLookupCallerByPhone) and opens the
// same widget used for outbound calls, so the rest of the UI (disposition,
// history) doesn't need to know which direction a call came from.
export function GlobalCallWidget() {
  const user = useAuthStore((s) => s.user);
  const { data: connection } = useJustCallConnection();
  const {
    isOpen,
    target,
    incoming,
    localCallId,
    status,
    durationSec,
    receiveIncomingCall,
    resolveIncomingCall,
    setLocalCallId,
    setStatus,
    close,
  } = useCallStore();

  const [loginState, setLoginState] = useState<LoggedInEventData | null>(null);
  const [dialerReady, setDialerReady] = useState(false);
  const dialedFor = useRef<string | null>(null);
  const incomingHandledFor = useRef<string | null>(null);

  const createCall = useCreateCall();
  const linkProviderCallId = useLinkProviderCallId();
  const { data: lookupResult, isFetched: lookupFetched } = useLookupCallerByPhone(incoming?.from);

  const canUse = !!user && canUseCalling(user);

  // Create the dialer singleton once this user is allowed to use it and
  // JustCall is actually connected -- never for a non-Sales/Admin user, and
  // never before an Admin has connected an account (the iframe would just
  // show a dead login screen).
  useEffect(() => {
    if (!canUse || !connection?.connected) return;

    const instance = getOrCreateDialer({
      onLogin: (data) => setLoginState(data),
      onLogout: () => setLoginState(null),
      onReady: () => setDialerReady(true),
    });

    instance.on("call-ringing", (data: CallRingingEventData) => {
      const store = useCallStore.getState();
      if (data.direction === "inbound") {
        store.receiveIncomingCall({
          from: data.from,
          to: data.to,
          providerCallId: data.call_sid ?? null,
        });
        return;
      }
      store.setStatus("ringing");
      if (store.localCallId && data.call_sid) {
        linkProviderCallId.mutate({ id: store.localCallId, providerCallId: data.call_sid });
      }
    });
    instance.on("call-answered", () => {
      useCallStore.getState().setStatus("connected");
    });
    instance.on("call-ended", (data: CallEndedEventData) => {
      useCallStore.getState().setStatus("ended", data.duration);
    });

    instance.ready().then(() => setDialerReady(true));
    setLoginState(getLoginState());

    // Deliberately no cleanup/unsubscribe: this effect only runs once for
    // the app's lifetime (canUse/connection.connected don't flip-flop in
    // normal use), and the dialer/iframe must outlive this component's
    // re-renders -- see justcall-dialer.ts's module comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse, connection?.connected]);

  // Once a target is queued (CallButton clicked) and the dialer is ready,
  // actually place the call: prepopulate JustCall's iframe with the number
  // and create our own Call row in parallel.
  useEffect(() => {
    if (!isOpen || !target || !dialerReady || status !== "initiating") return;
    if (dialedFor.current === target.toNumber) return;
    dialedFor.current = target.toNumber;

    const dialer = getOrCreateDialer({});
    dialer.dialNumber(target.toNumber);

    createCall.mutate(
      {
        toNumber: target.toNumber,
        fromNumber: loginState?.login_numbers?.[0],
        contactId: target.contactId,
        companyId: target.companyId,
        dealId: target.dealId,
        campaignId: target.campaignId,
      },
      { onSuccess: (call) => setLocalCallId(call.id) },
    );
  }, [isOpen, target, dialerReady, status, loginState, createCall, setLocalCallId]);

  useEffect(() => {
    dialedFor.current = null;
  }, [target?.toNumber]);

  // Once the caller lookup for an incoming call resolves (found or not),
  // create our Call row and promote `incoming` into a normal `target`.
  useEffect(() => {
    if (!incoming || !lookupFetched) return;
    if (incomingHandledFor.current === incoming.from) return;
    incomingHandledFor.current = incoming.from;

    createCall.mutate(
      {
        toNumber: incoming.to,
        fromNumber: incoming.from,
        direction: "INBOUND",
        contactId: lookupResult?.contactId,
        companyId: lookupResult?.company?.id,
        dealId: lookupResult?.deal?.id,
      },
      {
        onSuccess: (call) => {
          setLocalCallId(call.id);
          if (incoming.providerCallId) {
            linkProviderCallId.mutate({ id: call.id, providerCallId: incoming.providerCallId });
          }
          resolveIncomingCall({
            toNumber: incoming.from,
            displayName: lookupResult
              ? `${lookupResult.firstName} ${lookupResult.lastName}`
              : "Unknown caller",
            contactId: lookupResult?.contactId,
            companyId: lookupResult?.company?.id,
            dealId: lookupResult?.deal?.id,
          });
        },
      },
    );
  }, [
    incoming,
    lookupFetched,
    lookupResult,
    createCall,
    setLocalCallId,
    linkProviderCallId,
    resolveIncomingCall,
  ]);

  useEffect(() => {
    incomingHandledFor.current = null;
  }, [incoming?.from]);

  if (!canUse) return null;

  const showResolvingIncoming = !!incoming;
  const isUnknownCaller = !!target && !target.contactId;

  return (
    <>
      {/* Permanent mount point for the SDK's iframe -- see comment above. */}
      <div
        id={DIALER_CONTAINER_ID}
        className={cn("fixed z-50", isOpen ? "bottom-24 right-6" : "hidden")}
      />

      {isOpen && (target || showResolvingIncoming) ? (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-border-subtle bg-panel shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {target?.displayName ?? "Incoming call…"}
              </p>
              <p className="text-xs text-text-dim">{target?.toNumber ?? incoming?.from}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-text-dim hover:text-foreground shrink-0"
              aria-label="Close call widget"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            <StatusPill status={status} durationSec={durationSec} />

            {!connection?.connected ? (
              <p className="text-xs text-text-dim">
                JustCall isn't connected yet. Ask an Admin to connect it in Settings.
              </p>
            ) : !loginState?.logged_in ? (
              <p className="text-xs text-text-dim">
                Log into JustCall in the dialer panel above to place this call.
              </p>
            ) : null}

            {target?.dealId ? (
              <p className="text-[11px] text-text-dim">Linked to an open deal for this contact.</p>
            ) : null}

            {status === "ended" && localCallId ? (
              <div className="space-y-3">
                {isUnknownCaller && <UnknownCallerPrompt phone={target.toNumber} />}
                <CallDispositionForm callId={localCallId} onDone={close} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatusPill({ status, durationSec }: { status: string; durationSec: number | null }) {
  const config: Record<string, { label: string; icon: typeof Phone; className: string }> = {
    idle: { label: "Idle", icon: Phone, className: "text-text-dim" },
    initiating: { label: "Initiating…", icon: Phone, className: "text-text-dim" },
    ringing: { label: "Ringing…", icon: Phone, className: "text-warning" },
    connected: { label: "Connected", icon: Phone, className: "text-success" },
    ended: { label: "Call ended", icon: PhoneOff, className: "text-text-dim" },
  };
  const { label, icon: Icon, className } = config[status] ?? config.idle;
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Icon className="size-4" />
      <span>{label}</span>
      {durationSec != null ? (
        <span className="text-text-dim">
          · {Math.floor(durationSec / 60)}:{String(durationSec % 60).padStart(2, "0")}
        </span>
      ) : null}
    </div>
  );
}

export type { IncomingCall };
