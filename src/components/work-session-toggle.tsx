import { useEffect, useState } from "react";
import { Clock, Play, Square, Loader2, Monitor, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveWorkSession, useClockIn, useClockOut } from "@/hooks/use-work-session";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { captureClockPhoto } from "@/lib/capture-login-photo";

const CAMERA_ERROR_MESSAGES: Record<"denied" | "unsupported", string> = {
  denied:
    "Camera access is required to go online or offline. Please allow the camera prompt and try again.",
  unsupported: "This device/browser doesn't support camera capture, which is required to clock in or out.",
};

// Ongoing, ambient disclosure that screen monitoring is active -- not a
// one-time popup that's easy to forget. Shown for the whole clocked-in
// session, next to the Online/Offline toggle. See PROJECT_STATUS.md / phase
// 10 plan for why this exists: monitoring here is disclosed policy, not
// covert -- this indicator is part of what makes that true in practice.
function MonitoringIndicator() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-[10px] text-text-dim px-1 cursor-default">
            <Monitor className="size-3" />
            Screen monitoring active
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          Periodic screenshots are captured while clocked in, per company policy.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const MINIMUM_HOURS_MS = 8.5 * 60 * 60 * 1000; // 8 hours 30 mins in ms

export function WorkSessionToggle() {
  const { data: session, isLoading } = useActiveWorkSession();
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  const [elapsed, setElapsed] = useState<string>("00:00:00");
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [alertOpen, setAlertOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Tick elapsed time every second while active
  useEffect(() => {
    if (!session?.clockInAt) {
      setElapsed("00:00:00");
      setElapsedMs(0);
      return;
    }

    const start = new Date(session.clockInAt).getTime();
    
    function update() {
      const ms = Date.now() - start;
      setElapsedMs(ms);
      setElapsed(formatDuration(ms));
    }

    // Initial update
    update();

    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [session?.clockInAt]);

  if (isLoading) {
    return (
      <div className="flex h-[42px] items-center justify-center rounded-md border border-border-subtle bg-panel/50 text-text-dim">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const isPending = clockIn.isPending || clockOut.isPending || capturing;

  // Mandatory gate, not fire-and-forget: going online/offline requires a
  // successful camera capture first. Only a denied prompt or no camera
  // support blocks the action -- a photo that captured fine but failed to
  // *upload* (network hiccup) still lets the employee through, since that's
  // not something they did wrong. See capture-login-photo.ts.
  async function requireCameraOrBlock(type: "CLOCK_IN" | "CLOCK_OUT"): Promise<boolean> {
    setCameraError(null);
    setCapturing(true);
    try {
      const result = await captureClockPhoto(type);
      if (!result.ok && result.reason !== "upload-failed") {
        setCameraError(CAMERA_ERROR_MESSAGES[result.reason]);
        return false;
      }
      return true;
    } finally {
      setCapturing(false);
    }
  }

  async function handleClockInClick() {
    if (!(await requireCameraOrBlock("CLOCK_IN"))) return;
    clockIn.mutate();
  }

  async function handleClockOutClick() {
    if (!(await requireCameraOrBlock("CLOCK_OUT"))) return;
    if (elapsedMs < MINIMUM_HOURS_MS) {
      setAlertOpen(true);
    } else {
      clockOut.mutate();
    }
  }

  function handleConfirmClockOut() {
    setAlertOpen(false);
    clockOut.mutate();
  }

  if (session) {
    // Online
    return (
      <>
        <Button
          variant="outline"
          onClick={handleClockOutClick}
          disabled={isPending}
          className="w-full h-auto py-2 px-3 justify-between bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        >
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
              Online
            </span>
            <span className="text-[10px] font-medium opacity-80 font-mono">{elapsed}</span>
          </div>
          {isPending ? (
            <Loader2 className="size-4 animate-spin shrink-0" />
          ) : (
            <Square className="size-4 shrink-0 fill-current opacity-70" />
          )}
        </Button>
        <MonitoringIndicator />
        <CameraErrorNotice message={cameraError} />

        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to go offline?</AlertDialogTitle>
              <AlertDialogDescription>
                You have not completed the minimum required office hours (8 hours 30 mins).
                Your current session duration is {elapsed.split(":")[0]}h {elapsed.split(":")[1]}m.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmClockOut}>
                Go Offline Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Offline
  return (
    <>
      <Button
        variant="outline"
        onClick={handleClockInClick}
        disabled={isPending}
        className="w-full h-auto py-2 px-3 justify-between hover:bg-accent text-text-dim hover:text-foreground"
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs font-semibold">Offline</span>
          <span className="text-[10px] opacity-70">
            {capturing ? "Requesting camera…" : "Click to start session"}
          </span>
        </div>
        {isPending ? (
          <Loader2 className="size-4 animate-spin shrink-0" />
        ) : (
          <Play className="size-4 shrink-0 opacity-70 fill-current" />
        )}
      </Button>
      <CameraErrorNotice message={cameraError} />
    </>
  );
}

function CameraErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-destructive px-1 py-1">
      <Camera className="size-3 shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  );
}
