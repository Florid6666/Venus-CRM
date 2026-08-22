import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, refresh as refreshAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const authStatus = useAuthStore((s) => s.status);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Starts true so the form never flashes before the session check below
  // resolves -- same "don't render the real thing until confirmed" pattern
  // as the _app layout guard.
  const [checkingSession, setCheckingSession] = useState(true);

  // Visiting /login while already signed in (this tab still has an access
  // token, e.g. navigated back manually) or with a still-valid httpOnly
  // refresh cookie from an earlier login (a new tab, or this tab after a
  // reload) should skip straight to the app instead of asking for
  // credentials again. Component-level effect, not `beforeLoad` -- same
  // hydration-timing reason as everywhere else in this app (see _app.tsx).
  useEffect(() => {
    if (authStatus === "authenticated") {
      navigate({ to: "/" });
      return;
    }
    refreshAuth()
      .then(({ user, accessToken }) => {
        setAuth(user, accessToken);
        navigate({ to: "/" });
      })
      .catch(() => {
        setCheckingSession(false);
      });
  }, [authStatus, navigate, setAuth]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, accessToken } = await login(email, password);
      setAuth(user, accessToken);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Invalid email or password" : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-text-dim" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">
            V
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Sign in to Venus CRM</h1>
          <p className="text-sm text-text-dim">Enterprise operating system</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-text-dim hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
          <Link to="/forgot-password" className="block text-center text-xs text-text-dim hover:text-foreground">
            Forgot password?
          </Link>
        </form>
      </div>
    </div>
  );
}
