import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users2,
  KanbanSquare,
  CheckSquare,
  UserCircle2,
  MessagesSquare,
  Briefcase,
  TrendingUp,
  Search,
  Code2,
  BarChart3,
  BookOpen,
  Settings,
  Command,
  LogOut,
  Clock,
  Rocket,
  Monitor,
  Camera,
  Send,
  GraduationCap,
  Phone,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore, type CurrentUser } from "@/stores/auth-store";
import { logout as logoutApi } from "@/lib/api/auth";
import { getRoleLabel } from "@/lib/role-label";
import { WorkSessionToggle } from "@/components/work-session-toggle";
import { useTasks } from "@/hooks/use-tasks";
import { useDeals } from "@/hooks/use-deals";
import { useChatUnreadCount } from "@/hooks/use-chat";
import { useSearchStore } from "@/stores/search-store";

const CLOSED_DEAL_STAGES = new Set(["WON", "LOST", "ARCHIVED"]);

// badgeKey marks which items get a *real* dynamic count computed in
// AppSidebar (below) -- replaces what used to be hardcoded placeholder
// numbers ("12", "4", "3") left over from the original scaffold.
const groups: Array<{
  label: string;
  items: Array<{
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    badgeKey?: "tasks" | "crm" | "chat";
  }>;
}> = [
  {
    label: "Core OS",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/crm", label: "CRM & Sales", icon: Users2, badgeKey: "crm" },
      { to: "/projects", label: "Projects", icon: KanbanSquare },
      { to: "/tasks", label: "Tasks", icon: CheckSquare, badgeKey: "tasks" },
      { to: "/hr", label: "HRMS Portal", icon: UserCircle2 },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/sales", label: "Team Performance", icon: TrendingUp },
      { to: "/outreach", label: "Outreach", icon: Rocket },
      { to: "/inbox", label: "Inbox", icon: Mail },
      { to: "/bulk-email", label: "Bulk Email", icon: Send },
      { to: "/calls", label: "Calls", icon: Phone },
      { to: "/recruitment", label: "Recruitment", icon: Briefcase },
      { to: "/seo", label: "SEO Monitor", icon: Search },
      { to: "/dev", label: "Dev Sprints", icon: Code2 },
      { to: "/attendance", label: "Attendance", icon: Clock },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/chat", label: "Team Chat", icon: MessagesSquare, badgeKey: "chat" },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/knowledge", label: "Knowledge Base", icon: BookOpen },
      { to: "/screen-monitoring", label: "Screen Monitoring", icon: Monitor },
      { to: "/login-photos", label: "Login Photos", icon: Camera },
      { to: "/how-to-use", label: "How to Use CRM", icon: GraduationCap },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

// Routes whose content belongs to one specific department's work -- a Sales
// Manager must never even see the "Dev Sprints" or "SEO Monitor" links, let
// alone their data (the actual boundary is the backend's department-scoped
// reads; this just keeps irrelevant links out of the nav).
//
// /sales (Team Performance) is a deals/win-rate/quota view -- only meaningful
// for the Sales department, so it's department-scoped like the rest. It ALSO
// carries a Manager tier requirement (see MANAGER_ONLY_ROUTES).
const DEPARTMENT_ROUTES: Record<string, string> = {
  "/crm": "Sales",
  "/recruitment": "Recruitment",
  "/seo": "Digital Marketing",
  "/dev": "Dev",
  "/sales": "Sales",
  "/outreach": "Sales",
  "/inbox": "Sales",
  "/bulk-email": "Sales",
  "/calls": "Sales",
};

const MANAGER_ONLY_ROUTES = new Set(["/sales"]);

// Routes only an Admin should even see in the nav (the route itself is also
// guarded, but the link shouldn't show to everyone).
const ADMIN_ONLY_ROUTES = new Set(["/admin/settings"]);

// Routes hidden from one specific department while staying visible to
// everyone else -- the inverse of DEPARTMENT_ROUTES. Currently just Projects
// for Sales (a deal-centric role with no use for project management).
const DEPARTMENT_EXCLUDED_ROUTES: Record<string, string> = {
  "/projects": "Sales",
};

// Visible to Admin, HR, or any department's Manager -- doesn't fit the
// single-department allow/deny maps above (it's "any Manager, any
// department," not one specific department), so it's special-cased here.
const CUSTOM_VISIBILITY_ROUTES: Record<string, (user: CurrentUser) => boolean> = {
  "/screen-monitoring": (user) => user.department?.name === "HR" || user.role.name === "MANAGER",
  "/login-photos": (user) => user.department?.name === "HR" || user.role.name === "MANAGER",
  // Training material for running the CRM itself -- Admins (checked above)
  // and every department's Manager, matching the backend's rule in
  // TrainingVideosService.
  "/how-to-use": (user) => user.role.name === "MANAGER",
};

function isNavItemVisible(to: string, user: CurrentUser | null): boolean {
  if (!user) return false;
  if (user.role.name === "ADMIN") return true;
  // Past this point the user is not an Admin.
  if (ADMIN_ONLY_ROUTES.has(to)) return false;
  if (to in CUSTOM_VISIBILITY_ROUTES) return CUSTOM_VISIBILITY_ROUTES[to](user);
  if (DEPARTMENT_EXCLUDED_ROUTES[to] === user.department?.name) return false;
  const requiredDepartment = DEPARTMENT_ROUTES[to];
  if (requiredDepartment && user.department?.name !== requiredDepartment) return false;
  if (MANAGER_ONLY_ROUTES.has(to) && user.role.name !== "MANAGER") return false;
  return true;
}

export function AppSidebar() {
  const setSearchOpen = useSearchStore((s) => s.setSearchOpen);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);

  const showCrmBadge = !!user && isNavItemVisible("/crm", user);
  const { data: myTasks } = useTasks({ mine: true }, !!user);
  const { data: openDeals } = useDeals({}, showCrmBadge);
  const { data: chatUnread } = useChatUnreadCount();

  const badgeCounts: Record<"tasks" | "crm" | "chat", number | undefined> = {
    tasks: myTasks?.filter((t) => t.status !== "DONE").length,
    crm: openDeals?.filter((d) => !CLOSED_DEAL_STAGES.has(d.stage)).length,
    chat: chatUnread?.count,
  };

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((item) => isNavItemVisible(item.to, user))
        .map((item) => ({
          ...item,
          badge: item.badgeKey ? badgeCounts[item.badgeKey] : undefined,
        })),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen sticky top-0 border-r border-border-subtle bg-sidebar">
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-border-subtle">
        <div className="size-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20">
          V
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-semibold tracking-tight text-sm">Venus CRM</span>
          <span className="text-[10px] text-text-dim font-mono">v2.4.1</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {visibleGroups.map((g) => (
          <div key={g.label}>
            <div className="text-[10px] font-medium text-text-dim uppercase tracking-widest px-2 mb-1.5">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={
                      "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors " +
                      (active
                        ? "bg-accent text-foreground"
                        : "text-text-dim hover:text-foreground hover:bg-accent/50")
                    }
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {!!item.badge && item.badge > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel-elevated text-text-dim">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border-subtle space-y-3">
        <WorkSessionToggle />
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 rounded-md bg-panel-elevated/60 hover:bg-panel-elevated border border-border-subtle px-2.5 py-2 text-left transition-colors"
        >
          <Command className="size-3.5 text-text-dim" />
          <span className="text-xs text-text-dim flex-1">Command palette</span>
          <kbd className="text-[10px] font-mono text-text-dim">⌘K</kbd>
        </button>
        <UserMenu />
      </div>
    </aside>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  async function handleLogout() {
    try {
      await logoutApi();
    } finally {
      clearAuth();
      navigate({ to: "/login" });
    }
  }

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`;
  const roleLabel = getRoleLabel(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2.5 mt-3 px-1 py-1 rounded-md hover:bg-accent/50 transition-colors">
          <div className="size-8 rounded-full bg-gradient-to-br from-primary to-violet flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
            {initials}
          </div>
          <div className="flex-1 overflow-hidden text-left">
            <p className="text-xs font-medium truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[10px] text-text-dim truncate">{roleLabel}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-48">
        <DropdownMenuItem onSelect={() => navigate({ to: "/account" })}>
          <UserCircle2 className="size-3.5 mr-2" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-3.5 mr-2" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
