import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Monitor, ImageOff, Activity, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useScreenRecordings, useScreenRecordingVideo } from "@/hooks/use-screen-recordings";
import { formatFileSize } from "@/lib/format-file-size";
import type { ScreenRecording } from "@/lib/api/screen-recordings";
import { useActivitySummary } from "@/hooks/use-activity-monitoring";
import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_app/screen-monitoring")({
  component: ScreenMonitoringPage,
});

const ALL = "__all__";

function ScreenMonitoringPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  // Same "component-level effect, not beforeLoad" guard pattern used
  // throughout this app (see use-department-guard.ts) -- this route's
  // visibility rule (Admin, HR, or any department Manager) doesn't fit the
  // existing single-department allow/deny hooks, so it's inlined here.
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.role.name === "ADMIN";
    const isHR = currentUser.department?.name === "HR";
    const isManager = currentUser.role.name === "MANAGER";
    if (!isAdmin && !isHR && !isManager) {
      navigate({ to: "/" });
    }
  }, [currentUser, navigate]);

  const isAdminOrHR = currentUser?.role.name === "ADMIN" || currentUser?.department?.name === "HR";
  const { data: users } = useUsers();
  const selectableUsers = useMemo(
    () =>
      isAdminOrHR
        ? (users ?? [])
        : (users ?? []).filter((u) => u.department?.id === currentUser?.department?.id),
    [users, isAdminOrHR, currentUser],
  );

  const [userId, setUserId] = useState<string>(ALL);
  const { data: recordings, isLoading } = useScreenRecordings(userId === ALL ? {} : { userId });
  const [viewing, setViewing] = useState<ScreenRecording | undefined>(undefined);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Monitor className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Screen Monitoring</h1>
          <p className="text-sm text-text-dim mt-1">
            Periodic screenshots and mouse/keyboard activity level, captured during clocked-in
            hours, per company policy.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {selectableUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ActivitySummaryPanel userId={userId === ALL ? undefined : userId} />

      <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Recorded At</TableHead>
              <TableHead className="w-24">Length</TableHead>
              <TableHead className="w-24">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && recordings?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-dim py-8">
                  No screen recordings match these filters.
                </TableCell>
              </TableRow>
            )}
            {recordings?.map((recording) => (
              <TableRow
                key={recording.id}
                className="cursor-pointer"
                onClick={() => setViewing(recording)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">
                        {recording.user.firstName[0]}
                        {recording.user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {recording.user.firstName} {recording.user.lastName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-text-dim">
                  {recording.user.department?.name ?? "—"}
                </TableCell>
                <TableCell className="text-text-dim">
                  {new Date(recording.startedAt).toLocaleString()}
                </TableCell>
                <TableCell className="font-mono text-xs text-text-dim">
                  {Math.floor(recording.durationSec / 60)}m {recording.durationSec % 60}s
                </TableCell>
                <TableCell className="font-mono text-xs text-text-dim">
                  {formatFileSize(recording.sizeBytes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RecordingViewerDialog
        recording={viewing}
        onOpenChange={(open) => !open && setViewing(undefined)}
      />
    </div>
  );
}

// Active/idle % derived from the desktop agent's OS idle-time pings (see
// activity-monitoring backend module) -- never what was typed or clicked,
// just whether there was recent mouse/keyboard input.
function activityBarColor(percent: number): string {
  if (percent >= 60) return "bg-success";
  if (percent >= 30) return "bg-amber-500";
  return "bg-destructive";
}

function ActivitySummaryPanel({ userId }: { userId?: string }) {
  const { data: rows, isLoading } = useActivitySummary(userId ? { userId } : {});

  return (
    <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <Activity className="size-3.5 text-text-dim" />
        <span className="text-sm font-semibold">Activity</span>
        <span className="text-[10px] text-text-dim">
          Active/idle %, from mouse & keyboard input signal only — never what was typed or clicked.
        </span>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-dim py-6 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}
      {!isLoading && (!rows || rows.length === 0) && (
        <p className="text-sm text-text-dim py-6 text-center">
          No activity data yet for this filter.
        </p>
      )}
      {!isLoading && rows && rows.length > 0 && (
        <div className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <div key={row.user.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar className="size-6 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {row.user.firstName[0]}
                  {row.user.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm w-40 truncate shrink-0">
                {row.user.firstName} {row.user.lastName}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-canvas/60 overflow-hidden">
                <div
                  className={`h-full rounded-full ${activityBarColor(row.activePercent)}`}
                  style={{ width: `${row.activePercent}%` }}
                />
              </div>
              <span className="text-xs text-text-dim w-10 text-right shrink-0">
                {row.activePercent}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecordingViewerDialog({
  recording,
  onOpenChange,
}: {
  recording: ScreenRecording | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const videoUrl = useScreenRecordingVideo(recording?.id);

  return (
    <Dialog open={!!recording} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {recording
              ? `${recording.user.firstName} ${recording.user.lastName} · ${new Date(recording.startedAt).toLocaleString()}`
              : ""}
          </DialogTitle>
        </DialogHeader>
        {videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            controlsList="nodownload"
            className="aspect-video w-full rounded-lg border border-border-subtle bg-black"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center gap-2 text-text-dim">
            <ImageOff className="size-4" />
            Loading recording…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
