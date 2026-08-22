import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Clock, Calendar, History, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useWorkSessions } from "@/hooks/use-work-session";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_app/attendance")({
  component: AttendancePage,
});

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const canSeeAll = user?.role.name === "ADMIN" || user?.department?.name === "HR";

  const { data: sessions, isLoading } = useWorkSessions();

  // Group by date for stats (using the stored date field, which represents the shift date)
  const grouped = useMemo(() => {
    if (!sessions) return [];
    
    const groups = new Map<string, { dateStr: string; totalMin: number; count: number }>();
    
    for (const session of sessions) {
      if (session.durationMin == null) continue; // Skip active sessions in stats
      
      const dateKey = session.date.split("T")[0]; // YYYY-MM-DD
      const dateStr = new Date(session.date).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      const existing = groups.get(dateKey) || { dateStr, totalMin: 0, count: 0 };
      existing.totalMin += session.durationMin;
      existing.count += 1;
      groups.set(dateKey, existing);
    }

    return Array.from(groups.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [sessions]);

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Clock className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance & Work Sessions</h1>
          <p className="text-sm text-text-dim mt-1">
            {canSeeAll 
              ? "View work sessions for all employees across the company."
              : "Track your work hours and active sessions."}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - History Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-text-dim" />
            <h2 className="text-sm font-semibold">Session History</h2>
          </div>

          <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {canSeeAll && <TableHead>Employee</TableHead>}
                  <TableHead>Shift Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={canSeeAll ? 5 : 4} className="text-center text-text-dim py-8">
                      <Loader2 className="size-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && (!sessions || sessions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={canSeeAll ? 5 : 4} className="text-center text-text-dim py-8">
                      No work sessions recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {sessions?.map((session) => (
                  <TableRow key={session.id}>
                    {canSeeAll && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[10px]">
                              {session.user.firstName[0]}{session.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {session.user.firstName} {session.user.lastName}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      {new Date(session.date).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">
                      {new Date(session.clockInAt).toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-text-dim">
                      {session.clockOutAt ? (
                        new Date(session.clockOutAt).toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      ) : (
                        <span className="text-emerald-500 font-medium text-xs px-1.5 py-0.5 rounded bg-emerald-500/10">Active now</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-right">
                      {session.durationMin != null ? formatDuration(session.durationMin) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-text-dim" />
            <h2 className="text-sm font-semibold">Daily Summaries</h2>
          </div>

          <div className="bg-panel border border-border-subtle rounded-xl p-4 space-y-1">
            {grouped.length === 0 ? (
              <p className="text-sm text-text-dim text-center py-4">Not enough data for daily summaries.</p>
            ) : (
              grouped.map((g, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                  <span className="text-sm font-medium">{g.dateStr}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-text-dim text-xs">{g.count} session{g.count !== 1 ? 's' : ''}</span>
                    <span className="font-mono">{formatDuration(g.totalMin)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
