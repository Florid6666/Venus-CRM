import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Phone } from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useCalls, useJustCallConnection } from "@/hooks/use-telephony";
import { CallHistoryTable } from "@/components/telephony/call-history-table";
import { CallCampaignQueue } from "@/components/telephony/call-campaign-queue";
import { CallAnalyticsDashboard } from "@/components/telephony/call-analytics-dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CallStatus } from "@/lib/api/types";

export const Route = createFileRoute("/_app/calls")({
  component: CallsPage,
});

const STATUS_FILTERS: Array<{ value: CallStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CONNECTED", label: "Connected" },
  { value: "RINGING", label: "Ringing" },
  { value: "FAILED", label: "Failed" },
  { value: "BUSY", label: "Busy" },
  { value: "NO_ANSWER", label: "No answer" },
];

// Standalone call log -- Employees see their own calls, Manager/Admin see
// every Sales call (Admin explicitly unrestricted across departments too),
// see CallsService.visibilityScope on the backend.
function CallsPage() {
  useDepartmentGuard("Sales");
  const { data: connection } = useJustCallConnection();
  const [status, setStatus] = useState<CallStatus | "ALL">("ALL");

  const { data: calls } = useCalls(status === "ALL" ? {} : { status });
  const totalCalls = calls?.length ?? 0;
  const connected =
    calls?.filter((c) => c.status === "COMPLETED" || c.status === "CONNECTED").length ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Phone className="size-5" /> Calls
          </h1>
          <p className="text-sm text-text-dim mt-1">
            Every call placed through the CRM's JustCall dialer, with recordings and outcomes.
          </p>
        </div>
      </div>

      {connection && !connection.connected && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          JustCall isn't connected yet — ask an Admin to connect it in Settings before calling.
        </div>
      )}

      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log">Call Log</TabsTrigger>
          <TabsTrigger value="dialer">Power Dialer</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="grid grid-cols-2 gap-3 max-w-sm flex-1">
              <div className="rounded-xl border border-border-subtle bg-panel p-4">
                <p className="text-xs text-text-dim">Total calls</p>
                <p className="text-2xl font-semibold mt-1">{totalCalls}</p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-panel p-4">
                <p className="text-xs text-text-dim">Connected</p>
                <p className="text-2xl font-semibold mt-1">{connected}</p>
              </div>
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as CallStatus | "ALL")}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CallHistoryTable status={status === "ALL" ? undefined : status} />
        </TabsContent>

        <TabsContent value="dialer" className="mt-4">
          <CallCampaignQueue />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <CallAnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
