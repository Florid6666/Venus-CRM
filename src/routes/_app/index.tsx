import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useFollowUps } from "@/hooks/use-bulk-email";
import { useSequenceFollowUps } from "@/hooks/use-sequences";
import { ArrowUpRight, CheckCircle2, Circle, MessageCircle } from "lucide-react";
import { useSalesStats } from "@/hooks/use-dashboard";
import { DEAL_STAGE_LABELS } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth-store";
import { useSprints } from "@/hooks/use-sprints";
import { useTasks } from "@/hooks/use-tasks";
import { useChannels, useMessages } from "@/hooks/use-chat";
import { useRecruitmentAnalyticsSummary } from "@/hooks/use-recruitment";
import { CANDIDATE_STAGES, CANDIDATE_STAGE_LABELS } from "@/lib/api/recruitment";
import { useKeywords, useAudits, useBacklinks } from "@/hooks/use-seo";
import { useAppSettings } from "@/hooks/use-app-settings";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";
  const dept = currentUser?.department?.name;

  const showSales = isAdmin || dept === "Sales";
  const showDev = isAdmin || dept === "Dev";
  const showRecruitment = isAdmin || dept === "Recruitment";
  const showSeo = isAdmin || dept === "Digital Marketing";
  // Admin has no home department for SEO/Recruitment's own department-scoped
  // endpoints -- pass undefined so the backend's Admin override (see all)
  // kicks in instead of scoping to Admin's own (Executive) department.
  const seoDepartmentId = isAdmin ? undefined : currentUser?.department?.id;

  const { data: appSettings } = useAppSettings();
  const { data: salesStats } = useSalesStats(showSales);
  const { data: sprints } = useSprints(undefined, showDev);
  const { data: tasks } = useTasks({}, showDev);
  const { data: channels } = useChannels();
  const { data: recruitmentSummary } = useRecruitmentAnalyticsSummary(showRecruitment);
  const { data: keywords } = useKeywords(seoDepartmentId, showSeo);
  const { data: audits } = useAudits(seoDepartmentId, showSeo);
  const { data: backlinks } = useBacklinks(seoDepartmentId, showSeo);

  const generalChannel = channels?.find((c) => c.name === "general");
  const { data: chatMessages } = useMessages(generalChannel?.id);

  const activeSprint = useMemo(() => {
    return sprints?.find((s) => s.status === "ACTIVE") || null;
  }, [sprints]);

  const sprintTasks = useMemo(() => {
    return tasks?.filter((t) => t.sprintId === activeSprint?.id) || [];
  }, [tasks, activeSprint]);

  const completedTasks = useMemo(() => {
    return sprintTasks.filter((t) => t.status === "DONE");
  }, [sprintTasks]);

  const remainingDays = useMemo(() => {
    if (!activeSprint) return null;
    const diff = new Date(activeSprint.endDate).getTime() - Date.now();
    return Math.max(0, Math.round(diff / (24 * 3600 * 1000)));
  }, [activeSprint]);

  const wonThisMonth = salesStats?.wonThisMonth;
  const winRateLabel =
    salesStats?.winRateThisMonth != null ? `${Math.round(salesStats.winRateThisMonth)}% win rate` : "—";

  const revenueByMonth = salesStats?.revenueByMonth ?? [];
  const maxMonthValue = Math.max(1, ...revenueByMonth.map((m) => m.value));
  const lastTwoMonths = revenueByMonth.slice(-2);
  const monthOverMonthDelta =
    lastTwoMonths.length === 2 && lastTwoMonths[0].value > 0
      ? Math.round(((lastTwoMonths[1].value - lastTwoMonths[0].value) / lastTwoMonths[0].value) * 100)
      : null;

  const avgKeywordRank = useMemo(() => {
    const ranked = keywords?.filter((k) => k.currentRank != null) ?? [];
    if (ranked.length === 0) return null;
    return Math.round(ranked.reduce((sum, k) => sum + (k.currentRank ?? 0), 0) / ranked.length);
  }, [keywords]);

  const latestAudit = useMemo(() => {
    if (!audits || audits.length === 0) return null;
    return [...audits].sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime())[0];
  }, [audits]);

  const activeBacklinkCount = backlinks?.filter((b) => b.status === "VERIFIED").length ?? 0;

  const maxStageCount = useMemo(() => {
    if (!recruitmentSummary) return 1;
    return Math.max(1, ...CANDIDATE_STAGES.map((s) => recruitmentSummary.stageCounts[s]));
  }, [recruitmentSummary]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Greeting */}
      <section className="flex flex-wrap items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting()}, {currentUser?.firstName || "there"}
          </h1>
          <p className="text-sm text-text-dim mt-1">
            {appSettings?.heroTagline || "Welcome back to Venus CRM."}
            {showDev && activeSprint && ` · Active Sprint '${activeSprint.name}' closes in ${remainingDays} days.`}
            {showDev && !activeSprint && " · No active sprint currently."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          All systems operational
        </div>
      </section>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* KPI row -- each card only appears for the viewer's own department (or Admin) */}
        {showSales && (
          <>
            <KpiCard
              label="Monthly Revenue"
              value={wonThisMonth ? `$${wonThisMonth.value.toLocaleString()}` : "—"}
              delta={wonThisMonth ? `${wonThisMonth.count} deal${wonThisMonth.count === 1 ? "" : "s"}` : "—"}
              tone="primary"
            />
            <KpiCard
              label="Deals Won"
              value={wonThisMonth ? String(wonThisMonth.count) : "—"}
              delta={winRateLabel}
              positive={salesStats?.winRateThisMonth != null && salesStats.winRateThisMonth >= 50}
              tone="success"
            />
          </>
        )}
        {showDev && (
          <>
            <KpiCard
              label="Open Sprint Tasks"
              value={String(sprintTasks.filter((t) => t.status !== "DONE").length).padStart(2, "0")}
              delta={`${completedTasks.length} completed`}
              tone="violet"
            />
            <KpiCard
              label="Active Sprints"
              value={sprints ? String(sprints.filter((s) => s.status === "ACTIVE").length) : "—"}
              delta={activeSprint ? `'${activeSprint.name}'` : "None"}
              tone="info"
            />
          </>
        )}
        {showRecruitment && (
          <>
            <KpiCard
              label="Open Positions"
              value={recruitmentSummary ? String(recruitmentSummary.openPositions) : "—"}
              delta={`${recruitmentSummary?.totalCandidates ?? 0} candidates`}
              tone="primary"
            />
            <KpiCard
              label="Hires This Month"
              value={recruitmentSummary ? String(recruitmentSummary.hiresThisMonth) : "—"}
              delta={
                recruitmentSummary?.offerAcceptanceRate != null
                  ? `${recruitmentSummary.offerAcceptanceRate}% offer accept`
                  : "—"
              }
              tone="success"
            />
          </>
        )}
        {showSeo && (
          <>
            <KpiCard label="Tracked Keywords" value={keywords ? String(keywords.length) : "—"} delta={avgKeywordRank ? `avg rank ${avgKeywordRank}` : "—"} tone="violet" />
            <KpiCard
              label="Latest Audit Score"
              value={latestAudit ? String(latestAudit.score) : "—"}
              delta={latestAudit ? new Date(latestAudit.runAt).toLocaleDateString() : "No audits yet"}
              positive={!!latestAudit && latestAudit.score >= 80}
              tone="info"
            />
          </>
        )}

        {/* Active Sprint */}
        {showDev && (
          <Card className="col-span-12 lg:col-span-8">
            {activeSprint ? (
              <>
                <CardHeader
                  title={activeSprint.name}
                  subtitle={`Dev Sprints · ${remainingDays ?? "?"} days remaining`}
                />
                <div className="space-y-2">
                  {sprintTasks.length === 0 && (
                    <p className="text-sm text-text-dim py-2">No tasks in this sprint yet.</p>
                  )}
                  {sprintTasks.slice(0, 5).map((t, idx) => {
                    const statusTones: Record<string, string> = {
                      TODO: "text-text-dim",
                      IN_PROGRESS: "text-info",
                      REVIEW: "text-violet",
                      DONE: "text-success",
                    };
                    const statusLabels: Record<string, string> = {
                      TODO: "Todo",
                      IN_PROGRESS: "In Progress",
                      REVIEW: "Review",
                      DONE: "Done",
                    };
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 bg-canvas/50 p-3 rounded-lg border border-border-subtle hover:border-border transition-colors group"
                      >
                        {t.status === "DONE" ? (
                          <CheckCircle2 className="size-3.5 text-success shrink-0" />
                        ) : (
                          <Circle className="size-3.5 text-text-dim group-hover:text-primary transition-colors shrink-0" />
                        )}
                        <span className={`text-[10px] font-mono ${statusTones[t.status] ?? "text-text-dim"}`}>
                          DEV-{String(idx + 1).padStart(3, "0")}
                        </span>
                        <span className="text-sm flex-1 truncate">{t.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-panel-elevated text-text-dim">
                          {statusLabels[t.status] ?? t.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <CardHeader title="No Active Sprint" subtitle="Create a sprint in Dev Sprints to see tasks here." />
                <p className="text-sm text-text-dim">Head over to Dev Sprints to create and activate a sprint.</p>
              </>
            )}
          </Card>
        )}

        {/* Recruitment Pulse -- real pipeline funnel */}
        {showRecruitment && (
          <Card className="col-span-12 lg:col-span-4">
            <CardHeader title="Recruitment Pulse" subtitle="Candidates by current stage" />
            <div className="space-y-4">
              {recruitmentSummary && recruitmentSummary.totalCandidates === 0 && (
                <p className="text-xs text-text-dim">No active candidates right now.</p>
              )}
              {recruitmentSummary &&
                CANDIDATE_STAGES.map((stage) => {
                  const count = recruitmentSummary.stageCounts[stage];
                  const pct = Math.round((count / maxStageCount) * 100);
                  return (
                    <div key={stage} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">{CANDIDATE_STAGE_LABELS[stage]}</span>
                        <span className="text-text-dim">{count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-panel-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        )}

        {/* Revenue chart */}
        {showSales && (
          <Card className="col-span-12 md:col-span-6 lg:col-span-4">
            <CardHeader
              title="Revenue Trend"
              subtitle="Last 6 months"
              action={
                monthOverMonthDelta !== null ? (
                  <span
                    className={`text-[10px] font-mono flex items-center gap-1 ${
                      monthOverMonthDelta >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    <ArrowUpRight className={`size-3 ${monthOverMonthDelta < 0 ? "rotate-90" : ""}`} />
                    {monthOverMonthDelta >= 0 ? "+" : ""}
                    {monthOverMonthDelta}%
                  </span>
                ) : undefined
              }
            />
            <div className="h-24 flex items-end gap-1 mt-2">
              {revenueByMonth.map((m, i) => (
                <div
                  key={m.month}
                  className={`flex-1 rounded-sm ${
                    i === revenueByMonth.length - 1 ? "bg-primary" : "bg-primary/30"
                  }`}
                  style={{ height: `${(m.value / maxMonthValue) * 100}%` }}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Chat snippet -- universal, not department-specific */}
        <Card className="col-span-12 md:col-span-6 lg:col-span-5 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between bg-canvas/40">
            <span className="text-xs font-semibold flex items-center gap-2">
              <MessageCircle className="size-3.5 text-primary" />
              #{generalChannel?.name ?? "general"}
            </span>
            <span className="text-[10px] text-text-dim uppercase tracking-wider">
              {chatMessages?.length ?? 0} messages
            </span>
          </div>
          <div className="p-5 space-y-4">
            {chatMessages && chatMessages.length === 0 && (
              <p className="text-sm text-text-dim">No messages in #general yet.</p>
            )}
            {(chatMessages ?? []).slice(-3).map((m, i) => {
              const name = m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : "Unknown";
              const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
              const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const bgColors = ["bg-orange-500/80", "bg-blue-500/80", "bg-violet/80", "bg-emerald-500/80", "bg-rose-500/80"];
              const bg = bgColors[i % bgColors.length];
              return (
                <div key={m.id} className="flex gap-3">
                  <div className={`size-8 ${bg} rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0`}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">
                      {name}
                      <span className="text-[10px] text-text-dim ml-1.5 font-normal">{time}</span>
                    </p>
                    <p className="text-sm text-foreground/85 mt-0.5">{m.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-border-subtle bg-canvas/40">
            <div className="bg-panel-elevated rounded-md px-3 py-2 text-xs text-text-dim">
              Reply in #general…
            </div>
          </div>
        </Card>

        {/* High value deals */}
        {showSales && (
          <Card className="col-span-12 md:col-span-6 lg:col-span-3">
            <CardHeader title="High Value Deals" />
            <div className="space-y-3 -mx-1">
              {(salesStats?.topOpenDeals ?? []).map((d, i, arr) => (
                <div
                  key={d.id}
                  className={`px-1 flex flex-col gap-0.5 ${
                    i < arr.length - 1 ? "border-b border-border-subtle pb-2.5" : ""
                  }`}
                >
                  <span className="text-xs font-medium truncate">{d.title}</span>
                  <span className="text-[10px] text-text-dim">
                    ${d.value.toLocaleString()} · {DEAL_STAGE_LABELS[d.stage]}
                  </span>
                </div>
              ))}
              {salesStats && salesStats.topOpenDeals.length === 0 && (
                <p className="text-xs text-text-dim">No open deals yet.</p>
              )}
            </div>
          </Card>
        )}

        {/* Follow-Up Reminders */}
        {showSales && (
          <FollowUpsCard />
        )}

        {/* SEO Snapshot -- real keyword/audit/backlink data */}
        {showSeo && (
          <Card className="col-span-12 lg:col-span-4">
            <CardHeader title="SEO Snapshot" subtitle="Live keyword, audit, and backlink data" />
            <div className="grid grid-cols-2 gap-4 mt-1">
              <MiniStat label="Tracked keywords" value={keywords ? String(keywords.length) : "—"} />
              <MiniStat label="Avg keyword rank" value={avgKeywordRank != null ? String(avgKeywordRank) : "—"} />
              <MiniStat label="Active backlinks" value={String(activeBacklinkCount)} />
              <MiniStat
                label="Latest audit score"
                value={latestAudit ? `${latestAudit.score}/100` : "No audits"}
                positive={!!latestAudit && latestAudit.score >= 80}
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`bg-panel border border-border-subtle rounded-xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-text-dim mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  positive,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  tone: "primary" | "success" | "violet" | "info";
}) {
  const toneMap = {
    primary: "text-primary",
    success: "text-success",
    violet: "text-violet",
    info: "text-info",
  } as const;
  return (
    <div className="col-span-6 md:col-span-3 bg-panel border border-border-subtle rounded-xl p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-text-dim">
        {label}
      </p>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        <span
          className={`text-[11px] font-mono ${
            positive ? "text-success" : toneMap[tone]
          }`}
        >
          {delta}
        </span>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-text-dim">{label}</p>
      <p className={`text-lg font-semibold tabular-nums mt-0.5 ${positive ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}

interface FollowUpItem {
  id: string;
  name: string;
  channelLabel: string;
  subLabel: string;
  sentAt: string | null;
}

// Combines both outreach channels into one list so a lead going cold in a
// Sequence isn't invisible here just because it isn't a Bulk Email --
// each channel's own "cold" definition lives server-side (see
// common/utils/follow-up.ts) and stays identical across both.
function useAllFollowUps() {
  const { data: bulk, isLoading: bulkLoading } = useFollowUps();
  const { data: sequence, isLoading: sequenceLoading } = useSequenceFollowUps();

  const items = useMemo<FollowUpItem[]>(() => {
    const bulkItems: FollowUpItem[] = (bulk ?? []).map((f) => ({
      id: `bulk-${f.id}`,
      name: f.contact ? `${f.contact.firstName} ${f.contact.lastName}` : f.email,
      channelLabel: "Bulk Email",
      subLabel: f.campaign?.name ?? "Campaign",
      sentAt: f.sentAt,
    }));
    const sequenceItems: FollowUpItem[] = (sequence ?? []).map((s) => ({
      id: `seq-${s.id}`,
      name: `${s.enrollment.contact.firstName} ${s.enrollment.contact.lastName}`,
      channelLabel: "Sequence",
      subLabel: s.enrollment.sequence.name,
      sentAt: s.sentAt,
    }));
    return [...bulkItems, ...sequenceItems].sort((a, b) => {
      if (!a.sentAt) return 1;
      if (!b.sentAt) return -1;
      return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
    });
  }, [bulk, sequence]);

  return { items, isLoading: bulkLoading || sequenceLoading };
}

function FollowUpsCard() {
  const { items, isLoading } = useAllFollowUps();

  return (
    <Card className="col-span-12 md:col-span-6 lg:col-span-5">
      <CardHeader
        title="Follow-Up Reminders"
        subtitle="Unopened emails sent 3+ days ago, across Bulk Email and Sequences"
      />
      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-text-dim">Loading follow-ups...</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-xs text-text-dim">No pending follow-ups. Good job!</p>
        )}
        {!isLoading && items.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-b border-border-subtle pb-2 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{item.name}</p>
              <p className="text-[10px] text-text-dim truncate">
                {item.channelLabel} · {item.subLabel} ·{" "}
                {item.sentAt ? new Date(item.sentAt).toLocaleDateString() : ""}
              </p>
            </div>
            <Link
              to="/crm"
              className="text-[10px] font-medium text-primary hover:underline shrink-0"
            >
              Contact
            </Link>
          </div>
        ))}
      </div>
    </Card>
  );
}
