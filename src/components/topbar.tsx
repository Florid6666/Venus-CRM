import { Bell, Command, Plus, Search, Check, CheckCircle2 } from "lucide-react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { useSearchStore } from "@/stores/search-store";
import { useAuthStore } from "@/stores/auth-store";


const CRUMBS: Record<string, string> = {
  "/": "Dashboard / Overview",
  "/crm": "CRM & Sales / Leads",
  "/projects": "Projects / All",
  "/tasks": "Tasks / My Tasks",
  "/hr": "HRMS / Employees",
  "/sales": "Sales / Pipeline",
  "/recruitment": "Recruitment / Candidates",
  "/seo": "SEO / Monitor",
  "/dev": "Dev / Sprints",
  "/chat": "Communication / Team Chat",
  "/analytics": "Analytics / Overview",
  "/knowledge": "Knowledge Base",
  "/admin/settings": "Settings",
  "/attendance": "HRMS / Attendance",
};

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const crumb =
    CRUMBS[pathname] ??
    CRUMBS[Object.keys(CRUMBS).find((k) => k !== "/" && pathname.startsWith(k)) ?? "/"];

  const { data: notifications } = useNotifications();
  const { data: unreadCount } = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const user = useAuthStore((s) => s.user);
  const setSearchOpen = useSearchStore((s) => s.setSearchOpen);
  const setActiveDialog = useSearchStore((s) => s.setActiveDialog);

  const isAdmin = user?.role?.name === "ADMIN";
  const isManager = user?.role?.name === "MANAGER";
  const isHR = user?.department?.name === "HR" || isAdmin;
  const isSales = user?.department?.name === "Sales" || isAdmin;
  const isDev = user?.department?.name === "Dev" || isAdmin;
  const isRecruitment = user?.department?.name === "Recruitment" || isAdmin;
  const canCreateProject = isDev && (isAdmin || isManager);

  const count = unreadCount?.count ?? 0;

  return (
    <header className="h-14 shrink-0 border-b border-border-subtle flex items-center justify-between px-4 md:px-6 sticky top-0 bg-canvas/80 backdrop-blur-md z-20">
      <div className="flex items-center gap-4 min-w-0">
        <span className="text-sm text-text-dim truncate">{crumb}</span>
      </div>

      <div className="flex items-center gap-2.5">
        <button 
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex items-center gap-2 bg-panel/70 hover:bg-panel-elevated px-2.5 py-1.5 rounded-md border border-border-subtle text-xs text-text-dim transition-colors"
        >
          <Search className="size-3.5" />
          <span className="opacity-70">Search for anything…</span>
          <span className="mx-1 h-3 w-px bg-border-subtle" />
          <Command className="size-3" />
          <span className="font-mono">K</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Notifications"
              className="relative size-8 grid place-items-center rounded-md hover:bg-accent text-text-dim hover:text-foreground transition-colors"
            >
              <Bell className="size-4" strokeWidth={1.75} />
              {count > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary border-2 border-canvas" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <span className="text-sm font-semibold">Notifications</span>
              {count > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {!notifications || notifications.length === 0 ? (
                <div className="px-4 py-8 text-center flex flex-col items-center gap-2 text-text-dim">
                  <CheckCircle2 className="size-8 opacity-50" />
                  <p className="text-sm">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 p-3 transition-colors ${
                        !n.isRead ? "bg-primary/5" : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className={`text-sm truncate ${!n.isRead ? "font-semibold text-foreground" : "font-medium text-text-dim"}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-text-dim whitespace-nowrap">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-text-dim line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        {n.link && (
                          <button
                            onClick={() => {
                              if (!n.isRead) markRead.mutate(n.id);
                              navigate({ to: n.link as any }); // skip-typecheck for dynamic link
                            }}
                            className="text-[10px] font-medium text-primary mt-1.5 hover:underline"
                          >
                            View details →
                          </button>
                        )}
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={() => markRead.mutate(n.id)}
                          className="shrink-0 p-1 rounded-md text-text-dim hover:bg-accent hover:text-foreground"
                          title="Mark as read"
                        >
                          <Check className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-md shadow-lg shadow-primary/20 hover:brightness-110 transition inline-flex items-center gap-1.5">
              <Plus className="size-3.5" strokeWidth={2.5} />
              New Entry
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {isSales && (
              <>
                <DropdownMenuItem onClick={() => setActiveDialog("deal")}>
                  New Deal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveDialog("contact")}>
                  New Contact
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveDialog("company")}>
                  New Company
                </DropdownMenuItem>
              </>
            )}
            {isDev && (
              <>
                {canCreateProject && (
                  <DropdownMenuItem onClick={() => setActiveDialog("project")}>
                    New Project
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setActiveDialog("task")}>
                  New Task
                </DropdownMenuItem>
              </>
            )}
            {isRecruitment && (
              <>
                <DropdownMenuItem onClick={() => setActiveDialog("candidate")}>
                  New Candidate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveDialog("job-posting")}>
                  New Job Posting
                </DropdownMenuItem>
              </>
            )}
            {isHR && (
              <>
                <DropdownMenuItem onClick={() => setActiveDialog("employee")}>
                  New Employee
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveDialog("department")}>
                  New Department
                </DropdownMenuItem>
              </>
            )}
            {/* Common options for all users */}
            {!isSales && !isDev && !isRecruitment && !isHR && (
              <DropdownMenuItem onClick={() => setActiveDialog("task")}>
                New Task
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setActiveDialog("leave-request")}>
              Request Leave
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

