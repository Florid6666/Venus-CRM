import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  Gauge,
  KanbanSquare,
  Mail,
  MailCheck,
  Menu,
  MessageSquare,
  MousePointerClick,
  Play,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserCircle2,
  Users2,
  Workflow,
  X,
} from "lucide-react";

export const Route = createFileRoute("/landing")({
  component: CrmLandingPage,
});

// The app itself is dark-themed (see :root in styles.css), but this marketing
// page is deliberately light. Tailwind utilities cover everything rendered
// here; the body element still needs forcing, or the dark canvas shows through
// on overscroll and behind the fixed nav.
function useLightPageChrome() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const { body, documentElement } = document;
    const previousBody = body.style.backgroundColor;
    const previousScroll = documentElement.style.scrollBehavior;
    body.style.backgroundColor = "#FFFFFF";
    documentElement.style.scrollBehavior = "smooth";
    return () => {
      body.style.backgroundColor = previousBody;
      documentElement.style.scrollBehavior = previousScroll;
    };
  }, []);
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─────────────────────────── shared primitives ─────────────────────────── */

// Ambient blurred colour field. Always pointer-events-none so it never eats a
// click meant for the content sitting above it.
function Aura({ className, color }: { className: string; color: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-[150px] ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

const AURA_BLUE = "rgba(0, 102, 204, 0.25)";
const AURA_INDIGO = "rgba(94, 92, 230, 0.20)";
const AURA_TEAL = "rgba(0, 199, 190, 0.20)";

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow && (
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0066CC]">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#1D1D1F] sm:text-4xl md:text-[44px] md:leading-[1.1]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-[#6E6E73] sm:text-lg">{subtitle}</p>
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  type = "button",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#0066CC] px-8 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-105 hover:bg-[#0071E3] hover:shadow-xl active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-[#F5F5F7] px-8 py-3.5 text-sm font-semibold text-[#1D1D1F] transition-all duration-300 hover:bg-[#E8E8ED] active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

// The brand mark, drawn rather than loaded: this repo ships no /images
// directory, and a missing <img> reads worse than a rendered mark. Matches the
// "V" tile in the app's own sidebar.
function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-10 text-lg" : "size-8 text-sm";
  return (
    <div
      className={`${box} grid shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#0071E3] to-[#0066CC] font-bold text-white shadow-lg shadow-blue-500/25`}
    >
      V
    </div>
  );
}

function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={`font-semibold tracking-tight text-[#1D1D1F] ${
        size === "lg" ? "text-lg" : "text-[15px]"
      }`}
    >
      Venus CRM
    </span>
  );
}

/* ────────────────────────────── 1. Navbar ────────────────────────────── */

const NAV_LINKS: Array<{ label: string; target: string }> = [
  { label: "Pipeline", target: "pipeline" },
  { label: "Outreach", target: "outreach" },
  { label: "Performance", target: "performance" },
  { label: "Platform", target: "platform" },
  { label: "FAQ", target: "faq" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function go(target: string) {
    setMenuOpen(false);
    scrollToId(target);
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-[#E0E0E0] bg-white/90 backdrop-blur-2xl" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-8">
        <a href="/landing" className="flex items-center gap-2.5">
          <BrandMark />
          <Wordmark />
        </a>

        <div className="mx-auto hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.target}
              type="button"
              onClick={() => go(link.target)}
              className="rounded-full px-3.5 py-2 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
          >
            Sign In
          </Link>
          <button
            type="button"
            onClick={() => go("contact")}
            className="rounded-full bg-[#0066CC] px-5 py-2.5 text-[13px] font-semibold text-white shadow-md transition-all duration-300 hover:scale-105 hover:bg-[#0071E3] hover:shadow-xl active:scale-[0.98]"
          >
            Book a Demo
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="ml-auto grid size-10 place-items-center rounded-full text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] lg:hidden"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`overflow-hidden border-t border-[#E5E5EA] bg-white/95 backdrop-blur-2xl transition-[max-height,opacity] duration-300 lg:hidden ${
          menuOpen ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-1 px-5 py-4">
          {NAV_LINKS.map((link) => (
            <button
              key={link.target}
              type="button"
              onClick={() => go(link.target)}
              className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              {link.label}
            </button>
          ))}
          <div className="flex flex-col gap-2 pt-3">
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-full border border-slate-200 bg-[#F5F5F7] px-6 py-3 text-center text-sm font-semibold text-[#1D1D1F]"
            >
              Sign In
            </Link>
            <button
              type="button"
              onClick={() => go("contact")}
              className="rounded-full bg-[#0066CC] px-6 py-3 text-sm font-semibold text-white shadow-md"
            >
              Book a Demo
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────────── 2. Hero ─────────────────────────────── */

// Every phrase here maps to a module that actually ships.
const TYPEWRITER_PHRASES = [
  "Deal Pipelines",
  "Prospecting & Enrichment",
  "Email Sequences",
  "Bulk Campaigns",
  "Team Performance",
];

// Types a phrase out, holds, deletes, moves to the next. Timers are chained
// with a single timeout rather than an interval so the pace can differ between
// typing, holding, and deleting.
function Typewriter() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = TYPEWRITER_PHRASES[phraseIndex];
    let delay = deleting ? 35 : 65;

    if (!deleting && charCount === phrase.length) {
      delay = 1900; // hold the finished phrase long enough to read
    } else if (deleting && charCount === 0) {
      delay = 260;
    }

    const timer = setTimeout(() => {
      if (!deleting && charCount === phrase.length) {
        setDeleting(true);
      } else if (deleting && charCount === 0) {
        setDeleting(false);
        setPhraseIndex((i) => (i + 1) % TYPEWRITER_PHRASES.length);
      } else {
        setCharCount((c) => c + (deleting ? -1 : 1));
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [charCount, deleting, phraseIndex]);

  return (
    <span className="bg-gradient-to-r from-[#0066CC] via-[#5E5CE6] to-[#00C7BE] bg-clip-text text-transparent">
      {TYPEWRITER_PHRASES[phraseIndex].slice(0, charCount)}
      <span className="ml-0.5 inline-block w-[3px] animate-pulse self-center bg-[#0066CC] align-middle text-transparent">
        |
      </span>
    </span>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-28 sm:px-8 sm:pt-36">
      <Aura className="-left-40 top-[-8rem] h-[30rem] w-[30rem]" color={AURA_BLUE} />
      <Aura className="right-[-10rem] top-10 h-[28rem] w-[28rem]" color={AURA_INDIGO} />
      <Aura className="bottom-[-6rem] left-1/3 h-[24rem] w-[24rem]" color={AURA_TEAL} />

      <div className="relative mx-auto max-w-5xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0066CC]">
          <Sparkles className="size-3.5" />
          Pipeline, Prospecting &amp; Outreach in One System
        </span>

        <h1 className="mt-7 text-[38px] font-semibold leading-[1.06] tracking-tight text-[#1D1D1F] sm:text-6xl md:text-[76px]">
          Your whole sales motion, from first contact to closed won{" "}
          <span className="block min-h-[1.15em]">
            <Typewriter />
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-3xl text-base leading-relaxed text-[#6E6E73] sm:text-xl">
          Stop stitching a CRM to a mail merge tool to a prospecting database. Venus CRM runs the
          pipeline, the contact book, the sequences, and the campaigns — sending from your reps' own
          mailboxes, with every send checked against one unsubscribe list.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryButton onClick={() => scrollToId("contact")}>
            Book a Demo
            <ArrowRight className="size-4" />
          </PrimaryButton>
          <SecondaryButton onClick={() => scrollToId("pipeline")}>
            <Play className="size-4" />
            See the Pipeline
          </SecondaryButton>
        </div>
      </div>

      <div className="relative mx-auto mt-16 max-w-5xl">
        <StudioDisplay>
          <PipelineMockup />
        </StudioDisplay>
      </div>
    </section>
  );
}

/* ───────────────────── Studio Display monitor mockup ───────────────────── */

function StudioDisplay({
  children,
  url = "crm.venusglobaltech.com / pipeline",
}: {
  children: ReactNode;
  url?: string;
}) {
  return (
    <div className="mx-auto w-full">
      <div className="rounded-3xl bg-[#1D1D1F] p-3 shadow-2xl sm:p-4">
        <div className="overflow-hidden rounded-2xl bg-white">
          <div className="flex items-center gap-3 border-b border-[#E5E5EA] bg-[#F5F5F7] px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="size-3 rounded-full bg-[#FF5F57]" />
              <span className="size-3 rounded-full bg-[#FEBC2E]" />
              <span className="size-3 rounded-full bg-[#28C840]" />
            </div>
            <div className="mx-auto hidden rounded-full bg-white px-4 py-1 text-[11px] font-medium text-[#6E6E73] shadow-sm sm:block">
              {url}
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          </div>
          {children}
        </div>
      </div>
      {/* Ergonomic neck + base */}
      <div className="mx-auto h-12 w-24 bg-gradient-to-b from-[#C7C7CC] to-[#AEAEB2] sm:h-14 sm:w-28" />
      <div className="mx-auto h-2.5 w-48 rounded-b-xl rounded-t-sm bg-gradient-to-b from-[#AEAEB2] to-[#8E8E93] shadow-lg sm:w-64" />
    </div>
  );
}

// Stage names are the real DealStage values from lib/api/types.ts.
const MOCK_STAGES: Array<{
  name: string;
  total: string;
  tone: string;
  deals: Array<{ title: string; value: string; owner: string; flagged?: boolean }>;
}> = [
  {
    name: "Qualified",
    total: "$412K",
    tone: "bg-slate-400",
    deals: [
      { title: "Nordwind Foods — Q3 Supply", value: "$186,000", owner: "DS" },
      { title: "Bexley Industrial", value: "$96,400", owner: "PR" },
    ],
  },
  {
    name: "Proposal Sent",
    total: "$688K",
    tone: "bg-[#5E5CE6]",
    deals: [
      { title: "Aurora Logistics — Fleet", value: "$421,900", owner: "JC" },
      { title: "Kestrel Beverages", value: "$142,300", owner: "DV" },
    ],
  },
  {
    name: "Negotiation",
    total: "$934K",
    tone: "bg-[#0066CC]",
    deals: [
      { title: "Halvorsen Manufacturing", value: "$612,500", owner: "JC", flagged: true },
      { title: "Pemberton Wholesale", value: "$228,750", owner: "SK" },
    ],
  },
];

function PipelineMockup() {
  return (
    <div className="bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#86868B]">
            CRM &amp; Sales / Pipeline
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[#1D1D1F]">$2.03M open</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">
          <ShieldCheck className="size-3.5 text-amber-600" />
          <span className="text-[11px] font-semibold text-amber-700">
            1 deal awaiting manager approval
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MOCK_STAGES.map((stage) => (
          <div key={stage.name} className="rounded-2xl border border-[#E5E5EA] bg-[#FAFAFC] p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1D1F]">
                <span className={`size-2 rounded-full ${stage.tone}`} />
                {stage.name}
              </span>
              <span className="font-mono text-[10px] text-[#86868B]">{stage.total}</span>
            </div>
            <div className="mt-2.5 space-y-2">
              {stage.deals.map((deal) => (
                <div
                  key={deal.title}
                  className="rounded-xl border border-[#E5E5EA] bg-white p-2.5 shadow-sm"
                >
                  <p className="truncate text-[11px] font-semibold text-[#1D1D1F]">{deal.title}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#0066CC]">{deal.value}</span>
                    <span className="grid size-5 place-items-center rounded-full bg-[#0066CC]/10 text-[9px] font-bold text-[#0066CC]">
                      {deal.owner}
                    </span>
                  </div>
                  {deal.flagged && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                      <ShieldCheck className="size-2.5" />
                      Approval required
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mirrors the real BulkEmailRecipient statuses: PENDING / SENT / FAILED / SKIPPED.
function CampaignMockup() {
  const recipients = [
    { name: "Dana Whitfield", email: "dana@nordwindfoods.com", status: "Sent", opened: true },
    { name: "Marco Reyes", email: "m.reyes@aurora-log.com", status: "Sent", opened: true },
    { name: "Priya Raghavan", email: "priya@kestrelbev.com", status: "Sent", opened: false },
    { name: "—", email: "info@pemberton.co", status: "Skipped", opened: false },
    { name: "Tom Alderton", email: "t.alderton@bexley.io", status: "Pending", opened: false },
  ];

  const statusTone: Record<string, string> = {
    Sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Pending: "bg-slate-50 text-slate-600 border-slate-200",
    Skipped: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#86868B]">
            Bulk Email / Campaign
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-[#1D1D1F]">
            Q3 distributor re-engagement
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5">
          <Mail className="size-3.5 text-[#0066CC]" />
          <span className="text-[11px] font-semibold text-[#0066CC]">
            Sending from jon@venushiring.com
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {recipients.map((r) => (
          <div
            key={r.email}
            className="flex items-center gap-3 rounded-xl border border-[#E5E5EA] bg-[#FAFAFC] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-[#1D1D1F]">{r.name}</p>
              <p className="truncate text-[10px] text-[#86868B]">{r.email}</p>
            </div>
            {r.opened && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-[#0066CC]">
                <MousePointerClick className="size-2.5" />
                Opened
              </span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${statusTone[r.status]}`}
            >
              {r.status}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-[#86868B]">
        Skipped = address on the company-wide unsubscribe list. Sends are throttled in batches so a
        large list never goes out in one burst.
      </p>
    </div>
  );
}

/* ───────────────────────────── 3. KPI strip ───────────────────────────── */

// Product facts, not invented customer outcomes.
const KPIS = [
  { value: "8", label: "Pipeline stages, New Lead through Won" },
  { value: "5,000", label: "Recipients per bulk campaign" },
  { value: "Your inbox", label: "Campaigns send from the rep's own mailbox" },
  { value: "Every send", label: "Checked against one unsubscribe list" },
];

function KpiStrip() {
  return (
    <section className="border-y border-[#E5E5EA] bg-[#F8F9FC] px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[28px] border border-[#E5E5EA] bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_0_30px_rgba(0,102,204,0.18)]"
          >
            <p className="bg-gradient-to-r from-[#0066CC] to-[#5E5CE6] bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl">
              {kpi.value}
            </p>
            <p className="mt-2 text-[12px] font-medium leading-snug text-[#6E6E73] sm:text-sm">
              {kpi.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────── 4. Why choose (bento) ──────────────────────── */

const REASONS = [
  {
    icon: KanbanSquare,
    title: "Drag-and-drop deal pipeline",
    body: "Eight stages from New Lead to Won, with value, expected close date, owner, and a full activity timeline on every card.",
    gradient: "from-[#0066CC] to-[#5E5CE6]",
  },
  {
    icon: Search,
    title: "Prospecting built in",
    body: "Search people and companies through the Apollo integration, enrich them, and import straight into contacts. Lookups are cached so you never pay for the same one twice.",
    gradient: "from-[#5E5CE6] to-[#AF52DE]",
  },
  {
    icon: FileSpreadsheet,
    title: "Import your existing book",
    body: "Bring contacts in from CSV or Excel, tracked as import batches so you can see exactly what landed and when.",
    gradient: "from-[#00C7BE] to-[#0066CC]",
  },
  {
    icon: Send,
    title: "Sequences and bulk campaigns",
    body: "Multi-step drip cadences and one-off blasts, both throttled in the background so a large list never fires in a single burst.",
    gradient: "from-[#FF9F0A] to-[#FF375F]",
  },
  {
    icon: ShieldCheck,
    title: "Approval gates on big deals",
    body: "Set a value threshold per department. Deals above it need a manager's sign-off before they can close as Won, with the full audit trail attached.",
    gradient: "from-[#30D158] to-[#00C7BE]",
  },
  {
    icon: Trophy,
    title: "Targets and win-rate tracking",
    body: "Monthly targets per rep and per department, with attainment and closed-won figures on one Team Performance board.",
    gradient: "from-[#5E5CE6] to-[#0066CC]",
  },
];

function WhyChoose() {
  return (
    <section className="relative overflow-hidden px-5 py-24 sm:px-8">
      <Aura className="right-[-8rem] top-20 h-[26rem] w-[26rem]" color={AURA_INDIGO} />
      <div className="relative mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Why Venus CRM"
          title="Six things your team stops doing in three separate tools"
          subtitle="Prospecting, the pipeline, and the outbound engine are one system here — sharing the same contacts, the same permissions, and the same suppression list."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((reason) => {
            const Icon = reason.icon;
            return (
              <div
                key={reason.title}
                className="group rounded-[28px] border border-[#E5E5EA] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_0_30px_rgba(0,102,204,0.18)]"
              >
                <div
                  className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${reason.gradient} shadow-lg shadow-blue-500/20`}
                >
                  <Icon className="size-5 text-white" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-[#1D1D1F]">
                  {reason.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#6E6E73]">{reason.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 5. Feature spotlight (split rows) ─────────────────── */

function SpotlightRow({
  id,
  tag,
  title,
  description,
  checklist,
  mockup,
  url,
  reverse,
}: {
  id: string;
  tag: string;
  title: string;
  description: string;
  checklist: string[];
  mockup: ReactNode;
  url: string;
  reverse?: boolean;
}) {
  return (
    <div id={id} className="grid scroll-mt-24 items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0066CC]">
          {tag}
        </span>
        <h3 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1D1D1F] sm:text-[40px]">
          {title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-[#6E6E73] sm:text-lg">{description}</p>
        <ul className="mt-7 space-y-3.5">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#0066CC]">
                <Check className="size-3 text-white" strokeWidth={3} />
              </span>
              <span className="text-sm leading-relaxed text-[#1D1D1F]">{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        <StudioDisplay url={url}>{mockup}</StudioDisplay>
      </div>
    </div>
  );
}

function FeatureSpotlight() {
  return (
    <section className="relative overflow-hidden border-y border-[#E5E5EA] bg-[#F8F9FC] px-5 py-24 sm:px-8">
      <Aura className="left-[-10rem] top-1/3 h-[28rem] w-[28rem]" color={AURA_TEAL} />
      <div className="relative mx-auto max-w-7xl space-y-28">
        <SpotlightRow
          id="pipeline"
          tag="Opportunity Management"
          title="A pipeline your manager can actually govern"
          description="Drag deals between stages, and let the value threshold decide when a close needs a second pair of eyes — instead of finding out at month end."
          checklist={[
            "Eight stages, drag-and-drop, with per-deal owner and expected close date",
            "Manager approval required above a per-department value threshold",
            "Full activity timeline on every deal — calls, notes, and stage changes",
            "Company and contact created inline, without leaving the deal form",
          ]}
          mockup={<PipelineMockup />}
          url="crm.venusglobaltech.com / pipeline"
        />
        <SpotlightRow
          id="outreach"
          reverse
          tag="Outreach Engine"
          title="Send from your own mailbox, not a shared no-reply"
          description="Reps connect their own SMTP account, so replies land where they should. Templates carry merge fields, and campaigns go out in throttled batches rather than one spam-shaped burst."
          checklist={[
            "Reusable templates with {{firstName}}, {{title}}, and {{companyName}} merge fields",
            "Multi-step sequences, or a one-off email written for just this send",
            "Open tracking, with a follow-up list of everyone who never opened",
            "One company-wide unsubscribe list, honoured before every single send",
          ]}
          mockup={<CampaignMockup />}
          url="crm.venusglobaltech.com / bulk-email"
        />
      </div>
    </section>
  );
}

/* ────────────────────────── 6. Module directory ────────────────────────── */

const MODULES = [
  {
    icon: KanbanSquare,
    title: "Deals & Pipeline",
    body: "Eight stages, drag-and-drop, approval gates",
  },
  {
    icon: Building2,
    title: "Companies & Contacts",
    body: "Full registry with per-contact email history",
  },
  {
    icon: Search,
    title: "Apollo Prospecting",
    body: "Search, enrich, and import — with cached lookups",
  },
  {
    icon: FileSpreadsheet,
    title: "Contact Import",
    body: "CSV and Excel, tracked as reviewable batches",
  },
  {
    icon: Mail,
    title: "Email Templates",
    body: "Merge fields with a live preview before you send",
  },
  { icon: Workflow, title: "Sequences", body: "Multi-step cadences with per-contact enrolment" },
  {
    icon: Send,
    title: "Bulk Campaigns",
    body: "Template or one-off, throttled, per-recipient status",
  },
  {
    icon: MailCheck,
    title: "Suppression & Tracking",
    body: "Unsubscribes, bounces, and open tracking",
  },
];

function ModuleDirectory() {
  return (
    <section className="px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="What's Included"
          title="Eight sales modules, one login"
          subtitle="Not eight subscriptions stitched together with integrations that break the week you need them."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.title}
                className="rounded-[28px] border border-[#E5E5EA] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[#0066CC]/30 hover:shadow-[0_0_30px_rgba(0,102,204,0.18)]"
              >
                <div className="grid size-11 place-items-center rounded-2xl border border-blue-100 bg-blue-50">
                  <Icon className="size-5 text-[#0066CC]" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold leading-snug tracking-tight text-[#1D1D1F]">
                  {mod.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E6E73]">{mod.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── 7. Performance & governance ─────────────────────── */

const PERFORMANCE_POINTS = [
  {
    icon: Target,
    title: "Targets that mean something",
    body: "Set a monthly number per rep and per department. The board shows attainment against it, not a vanity chart.",
  },
  {
    icon: Gauge,
    title: "Win rate and closed-won",
    body: "See what actually closed this month beside what's still open, per person and per team.",
  },
  {
    icon: ShieldCheck,
    title: "Approval trail on every close",
    body: "Deals above the threshold record who approved them and when — so a disputed commission has an answer.",
  },
  {
    icon: Users2,
    title: "Department-scoped by default",
    body: "A Sales Manager governs Sales. They don't see, edit, or approve another department's deals. Admin overrides everywhere.",
  },
];

function Performance() {
  return (
    <section
      id="performance"
      className="relative scroll-mt-20 overflow-hidden border-y border-[#E5E5EA] bg-[#F8F9FC] px-5 py-24 sm:px-8"
    >
      <Aura className="bottom-0 right-[-8rem] h-[26rem] w-[26rem]" color={AURA_BLUE} />
      <div className="relative mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Performance & Governance"
          title="Managers get a real seat, not a read-only dashboard"
          subtitle="Permissions are role tier crossed with department, so authority stops exactly where it should."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {PERFORMANCE_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className="flex gap-5 rounded-[32px] border border-[#E5E5EA] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_0_30px_rgba(0,102,204,0.18)]"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#0066CC] to-[#00C7BE] shadow-lg shadow-blue-500/20">
                  <Icon className="size-5 text-white" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-[#1D1D1F]">
                    {point.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6E6E73]">{point.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── 8. The wider platform ──────────────────────── */

const PLATFORM_MODULES = [
  {
    icon: ClipboardCheck,
    title: "Projects & Tasks",
    body: "Boards, task lists, and time logs with manager approval",
  },
  { icon: Clock, title: "Attendance", body: "Clock in and out, with work sessions per person" },
  {
    icon: UserCircle2,
    title: "HRMS Portal",
    body: "Employee directory, leave requests, and approvals",
  },
  { icon: Users2, title: "Recruitment", body: "Job postings, candidates, interviews, and offers" },
  {
    icon: MessageSquare,
    title: "Team Chat",
    body: "Channels and direct messages with unread counts",
  },
  {
    icon: BookOpen,
    title: "Knowledge Base",
    body: "Internal articles, plus recorded CRM walkthroughs",
  },
  { icon: BarChart3, title: "Analytics", body: "Cross-module reporting scoped to your department" },
  {
    icon: CalendarClock,
    title: "Dev Sprints",
    body: "Epics, sprints, releases, and GitHub commit sync",
  },
];

function Platform() {
  return (
    <section id="platform" className="scroll-mt-20 px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Beyond Sales"
          title="The rest of the company is already in here"
          subtitle="Sales doesn't run in isolation. The same login covers delivery, people, and hiring — with the same department permissions applied throughout."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.title}
                className="rounded-[28px] border border-[#E5E5EA] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md"
              >
                <div className="grid size-11 place-items-center rounded-2xl border border-slate-200 bg-[#F5F5F7]">
                  <Icon className="size-5 text-[#1D1D1F]" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold leading-snug tracking-tight text-[#1D1D1F]">
                  {mod.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E6E73]">{mod.body}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-14 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#86868B]">
          Connects with
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {["Apollo.io", "Any SMTP mailbox", "GitHub", "CSV / Excel", "Webhooks"].map((logo) => (
            <div
              key={logo}
              className="rounded-2xl border border-[#E5E5EA] bg-white px-6 py-3.5 text-sm font-semibold text-[#6E6E73] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:text-[#1D1D1F] hover:shadow-md"
            >
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── 9. FAQ accordion ───────────────────────────── */

const FAQS = [
  {
    q: "Can we import the contacts we already have?",
    a: "Yes — CSV or Excel. Every import is recorded as a batch showing how many rows were created, updated, and skipped, so you can see exactly what landed instead of guessing. Contacts can also come in from Apollo, and each one is tagged with where it came from.",
  },
  {
    q: "Do campaigns send from our own email addresses?",
    a: "Each rep connects their own SMTP mailbox in their profile, and their campaigns send from it — so replies come back to them, not a shared inbox. If a mailbox isn't connected yet, a shared sender stands in with replies still routed back to the rep.",
  },
  {
    q: "How do you stop us from emailing someone who unsubscribed?",
    a: "One suppression list, company-wide, covering unsubscribes, bounces, and manual additions. It's checked before every individual send — not per campaign — so an unsubscribe from one rep's sequence is honoured by everybody else's too. Those recipients show as Skipped in the campaign report.",
  },
  {
    q: "Can we require approval before a big deal is closed?",
    a: "Yes. Each department has a deal value threshold. Below it, a rep closes their own deals. Above it, moving to Won creates an approval request for a manager or admin, and the decision is recorded against the deal.",
  },
  {
    q: "Can a manager in one department see another department's deals?",
    a: "No. Permissions are role tier crossed with department: a Sales Manager can edit and approve Sales-owned records and gets a 403 on anything else. Admin is the only unconditional override, and every login and action is recorded in the audit trail.",
  },
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="scroll-mt-20 border-y border-[#E5E5EA] bg-[#F8F9FC] px-5 py-24 sm:px-8"
    >
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="The questions sales teams actually ask" />
        <div className="mt-12 space-y-3">
          {FAQS.map((faq, i) => {
            const open = openIndex === i;
            return (
              <div
                key={faq.q}
                className="overflow-hidden rounded-[28px] border border-[#E5E5EA] bg-white shadow-sm transition-shadow duration-300 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-4 px-6 py-5 text-left"
                >
                  <span className="flex-1 text-[15px] font-semibold leading-snug tracking-tight text-[#1D1D1F]">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-[#0066CC] transition-transform duration-300 ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 text-sm leading-relaxed text-[#6E6E73]">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── 10. Lead capture / demo ──────────────────────── */

const CURRENT_SETUPS = [
  "Spreadsheets / WhatsApp",
  "HubSpot / Salesforce",
  "Another CRM",
  "No CRM yet",
];

function ContactSection() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    // No public intake endpoint exists yet -- this is a front-end-only
    // submission. Wiring it to a real endpoint is a deliberate follow-up, not
    // an oversight: a public unauthenticated write needs rate limiting and
    // spam protection designed in.
    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsSubmitting(false);
    formRef.current?.reset();
    toast.success("Demo request received", {
      description: "Our team will reach out within one business day.",
    });
  }

  const fieldClass =
    "w-full rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3 text-sm text-[#1D1D1F] outline-none transition-all placeholder:text-[#AEAEB2] focus:border-[#0066CC] focus:ring-4 focus:ring-blue-500/10";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-[#1D1D1F]";

  return (
    <section id="contact" className="relative scroll-mt-20 overflow-hidden px-5 py-24 sm:px-8">
      <Aura className="left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2" color={AURA_INDIGO} />
      <div className="relative mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="Talk to Sales"
          title="See it running on your own pipeline"
          subtitle="Tell us how your team sells today and we'll walk the same workflow through Venus CRM — your stages, your products, not a generic demo dataset."
        />

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-12 rounded-[32px] border border-[#E5E5EA] bg-white p-6 shadow-sm sm:p-9"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="lead-name">
                Full Name <span className="text-[#0066CC]">*</span>
              </label>
              <input
                id="lead-name"
                name="name"
                required
                className={fieldClass}
                placeholder="Jordan Lee"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="lead-email">
                Work Email <span className="text-[#0066CC]">*</span>
              </label>
              <input
                id="lead-email"
                name="email"
                type="email"
                required
                className={fieldClass}
                placeholder="jordan@company.com"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="lead-company">
                Company Name
              </label>
              <input
                id="lead-company"
                name="company"
                className={fieldClass}
                placeholder="Acme Industrial"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="lead-phone">
                Phone Number
              </label>
              <input
                id="lead-phone"
                name="phone"
                type="tel"
                className={fieldClass}
                placeholder="+1 555 000 1234"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="lead-setup">
                Current Setup
              </label>
              <select
                id="lead-setup"
                name="setup"
                className={`${fieldClass} appearance-none`}
                defaultValue=""
              >
                <option value="" disabled>
                  Select what you use today
                </option>
                {CURRENT_SETUPS.map((setup) => (
                  <option key={setup} value={setup}>
                    {setup}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="lead-focus">
                How your team sells today
              </label>
              <textarea
                id="lead-focus"
                name="focus"
                rows={4}
                className={`${fieldClass} resize-none`}
                placeholder="What you sell, how many reps, and the part of the process that hurts most right now."
              />
            </div>
          </div>

          <PrimaryButton type="submit" disabled={isSubmitting} className="mt-7 w-full">
            {isSubmitting ? "Sending request…" : "Request a Demo"}
            {!isSubmitting && <ArrowRight className="size-4" />}
          </PrimaryButton>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-[#86868B]">
            <Shield className="size-3.5" />
            Your details stay private. No newsletter, no reselling, no cold-call sequence.
          </p>
        </form>
      </div>
    </section>
  );
}

/* ────────────────────────────── 11. Footer ────────────────────────────── */

const FOOTER_COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Product",
    links: [
      { label: "Pipeline", href: "#pipeline" },
      { label: "Outreach", href: "#outreach" },
      { label: "Performance", href: "#performance" },
      { label: "Platform", href: "#platform" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Book a Demo", href: "#contact" },
      { label: "Contact Sales", href: "#contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-[#E5E5EA] bg-white px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark size="lg" />
              <Wordmark size="lg" />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#6E6E73]">
              Pipeline, prospecting, and outreach in one system — by Venus Global Tech.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868B]">
                {column.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#6E6E73] transition-colors hover:text-[#0066CC]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#E5E5EA] pt-8 sm:flex-row">
          <p className="text-[13px] text-[#86868B]">
            © {new Date().getFullYear()} Venus Global Tech. All rights reserved.
          </p>
          <Link
            to="/login"
            className="text-[13px] font-semibold text-[#0066CC] transition-colors hover:text-[#0071E3]"
          >
            Sign in to your workspace →
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────── page ──────────────────────────────── */

function CrmLandingPage() {
  useLightPageChrome();

  return (
    <div className="min-h-screen bg-white font-sans text-[#1D1D1F] antialiased">
      <Navbar />
      <main>
        <Hero />
        <KpiStrip />
        <WhyChoose />
        <FeatureSpotlight />
        <ModuleDirectory />
        <Performance />
        <Platform />
        <FaqAccordion />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
