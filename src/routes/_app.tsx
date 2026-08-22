import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";
import { GlobalDialogs } from "@/components/global-dialogs";
import { useAuthStore } from "@/stores/auth-store";
import { refresh as refreshAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// How soon to retry the initial session check after a transient failure
// (no response at all, or a 5xx) -- most commonly this page loaded right as
// the network wasn't ready yet (e.g. the desktop app's window opening right
// after the machine woke from sleep). Never treat that as "not logged in."
const AUTH_CHECK_RETRY_MS = 5_000;

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);

  // Deliberately a component-level effect, not a route `beforeLoad` guard:
  // beforeLoad isn't guaranteed to re-run on the client for the route that
  // was already active during the initial SSR/hydration pass, which left
  // visitors stuck on a permanent loading state (status never left "idle",
  // nothing ever redirected) when the check lived there alone. useEffect on
  // this component is guaranteed to fire once mounted in the browser,
  // regardless of the router's hydration/re-execution semantics.
  useEffect(() => {
    const store = useAuthStore.getState();
    if (store.status === "authenticated" && store.accessToken) {
      return;
    }

    let cancelled = false;

    function attempt() {
      refreshAuth()
        .then(({ user, accessToken }) => {
          if (!cancelled) store.setAuth(user, accessToken);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 401) {
            // The server genuinely has no valid session for us -- this is
            // the only case where sending them to /login is correct.
            store.clearAuth();
            navigate({ to: "/login" });
          } else {
            // Transient failure (network not up yet, a 5xx) -- retry rather
            // than bouncing a real session to the login page over a blip.
            setTimeout(attempt, AUTH_CHECK_RETRY_MS);
          }
        });
    }
    attempt();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Never render the real shell (sidebar/topbar/dashboard structure) until a
  // client has actually confirmed a session -- covers both the SSR pass and
  // the brief window before the effect above resolves. A visitor without a
  // valid session sees only this loading state before landing on /login.
  if (typeof document === "undefined" || status !== "authenticated") {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-text-dim" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-canvas text-foreground">
      <AppSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </main>
      <CommandPalette />
      <GlobalDialogs />
    </div>
  );
}
