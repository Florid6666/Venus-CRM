export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "READY_FOR_TESTING" | "CHANGES_REQUIRED" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type RoleName = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type TaskType = "FEATURE" | "BUG" | "REFACTOR" | "CHORE";

export const TASK_TYPES: TaskType[] = ["FEATURE", "BUG", "REFACTOR", "CHORE"];
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  FEATURE: "Feature",
  BUG: "Bug",
  REFACTOR: "Refactor",
  CHORE: "Chore",
};

export const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "READY_FOR_TESTING",
  "CHANGES_REQUIRED",
  "DONE",
];
export const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const PROJECT_STATUSES: ProjectStatus[] = ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];

export const ROLE_NAMES: RoleName[] = ["ADMIN", "MANAGER", "EMPLOYEE"];
export const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  READY_FOR_TESTING: "Ready for Testing",
  CHANGES_REQUIRED: "Changes Required",
  DONE: "Completed",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  managerTitle: string;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  githubUsername: string | null;
  isActive: boolean;
  monthlyTarget: number | null;
  role: { id: string; name: RoleName };
  department: DepartmentSummary | null;
  manager: PersonRef | null;
}

export type AuthEventType = "LOGIN" | "LOGOUT";

export interface LoginEvent {
  id: string;
  type: AuthEventType;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    department: { id: string; name: string } | null;
  };
}

export interface LastLogin {
  userId: string;
  lastLoginAt: string | null;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  monthlyTarget: number | null;
  dealApprovalThreshold: number;
  headId: string | null;
  head: PersonRef | null;
  createdAt: string;
  updatedAt: string;
  _count: { employees: number };
}

export interface DepartmentDetail extends Department {
  employees: (PersonRef & { email: string })[];
}

export interface Task {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  projectId: string | null;
  assigneeId: string | null;
  creatorId: string;
  dueDate: string | null;
  storyPoints: number | null;
  type: TaskType;
  sprintId: string | null;
  epicId: string | null;
  releaseId: string | null;
  parentId: string | null;
  subtasks: Task[];
  departmentId: string | null;
  taskListId: string | null;
  startDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  assignee: PersonRef | null;
  creator: Pick<PersonRef, "id" | "firstName" | "lastName">;
  project: { id: string; name: string } | null;
  taskList: { id: string; name: string } | null;
  // Just minutes, enough to sum for the Duration column -- see
  // TimeLog for full entries (date/note/who).
  timeLogs: Array<{ minutes: number }>;
  // Latest progress update only (for compact display); full history comes
  // from useTaskUpdates(taskId) instead.
  updates: TaskUpdate[];
  _count: { updates: number };
}

export interface TaskList {
  id: string;
  name: string;
  projectId: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  _count: { tasks: number };
}

export type TimeLogStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  date: string;
  minutes: number;
  note: string | null;
  status: TimeLogStatus;
  reviewedById: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: PersonRef;
  reviewedBy: PersonRef | null;
  task: { id: string; title: string; project: { id: string; name: string } | null };
}

export type SuppressionReason = "UNSUBSCRIBED" | "BOUNCED" | "MANUAL";

export interface EmailSuppression {
  id: string;
  email: string;
  reason: SuppressionReason;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  // Appends the *sender's* signature at send time -- see composeEmailHtml on
  // the server, not baked into the shared template body.
  appendSignature: boolean;
  departmentId: string | null;
  creatorId: string;
  creator: PersonRef;
  createdAt: string;
  updatedAt: string;
}

export type SequenceStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "STOPPED";
export type SendStatus = "PENDING" | "SENT" | "FAILED";

export interface SequenceStep {
  id: string;
  sequenceId: string;
  order: number;
  delayDays: number;
  templateId: string;
  template: { id: string; name: string; subject: string };
  createdAt: string;
  updatedAt: string;
}

export interface SequenceEnrollment {
  id: string;
  sequenceId: string;
  contactId: string;
  status: EnrollmentStatus;
  currentStepOrder: number;
  nextSendAt: string;
  enrolledById: string;
  stoppedReason: string | null;
  contact: { id: string; firstName: string; lastName: string; email: string | null };
  enrolledBy: PersonRef;
  // Present when nested under Contact.sequenceEnrollments (the "Email
  // History" panel) -- not selected by the sequence detail page, which
  // already knows its own sequence and fetches contact/enrolledBy instead.
  sequence?: { name: string };
  sends?: Array<{
    id: string;
    status: SendStatus;
    openedAt?: string | null;
    openCount?: number;
    sentAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface Sequence {
  id: string;
  name: string;
  description: string | null;
  status: SequenceStatus;
  departmentId: string | null;
  creatorId: string;
  creator: PersonRef;
  steps: SequenceStep[];
  _count: { enrollments: number };
  createdAt: string;
  updatedAt: string;
}

export interface SequenceDetail extends Sequence {
  enrollments: SequenceEnrollment[];
}

export interface SequenceEnrollResult {
  contactId: string;
  enrolled: boolean;
  reason?: string;
}

export type BulkSendStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export interface BulkEmailRecipient {
  id: string;
  campaignId: string;
  contactId: string | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  email: string;
  status: BulkSendStatus;
  errorMessage: string | null;
  sentAt: string | null;
  openedAt?: string | null;
  openCount?: number;
  // Present on the follow-ups endpoint and when nested under
  // Contact.bulkEmailRecipients (the "Email History" panel) -- not selected
  // inside a campaign detail page, which is already scoped to one campaign.
  campaign?: { id?: string; name: string };
  createdAt: string;
}

export interface BulkEmailCampaign {
  id: string;
  name: string;
  // Null when the campaign was written as a one-off on the Bulk Email page
  // instead of from a saved template -- subject/bodyHtml carry it then.
  templateId: string | null;
  template: { id: string; name: string; subject: string } | null;
  subject: string | null;
  bodyHtml: string | null;
  creatorId: string;
  creator: PersonRef;
  _count: { recipients: number };
  statusCounts: Partial<Record<BulkSendStatus, number>>;
  createdAt: string;
}

export interface BulkEmailCampaignDetail extends BulkEmailCampaign {
  recipients: BulkEmailRecipient[];
}

export interface EmailConnectionStatus {
  connected: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUsername: string | null;
  fromName: string | null;
  fromEmail: string | null;
  verified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  httpFallbackAvailable: boolean;
}

export interface NetworkDiagnosticResult {
  label: string;
  host: string;
  port: number;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface SequenceSend {
  id: string;
  enrollmentId: string;
  stepId: string | null;
  status: SendStatus;
  errorMessage: string | null;
  sentAt: string;
  openedAt?: string | null;
  openCount?: number;
  step: { id: string; template: { name: string } } | null;
  enrollment: {
    id: string;
    sequence: { id: string; name: string };
    contact: { id: string; firstName: string; lastName: string; email: string | null };
  };
}

export interface TaskUpdate {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: PersonRef;
}

// Returned by the sprint-wide feed, which also needs to say which task each
// update belongs to.
export interface SprintTaskUpdate extends TaskUpdate {
  task: { id: string; taskNumber: number; title: string; status: TaskStatus };
}

export interface ProjectTaskUpdate extends TaskUpdate {
  task: { id: string; taskNumber: number; title: string; status: TaskStatus };
}

export interface DepartmentTaskUpdate extends TaskUpdate {
  task: { id: string; title: string; status: TaskStatus };
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assigneeId: string | null;
  testerId: string | null;
  dueDate: string | null;
  taskListId: string | null;
  startDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  assignee: PersonRef | null;
  taskList: { id: string; name: string } | null;
  timeLogs: Array<{ minutes: number }>;
  // Latest progress note only, for the Kanban card's at-a-glance summary.
  updates: TaskUpdate[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  ownerId: string;
  startDate: string | null;
  dueDate: string | null;
  githubUrl: string | null;
  projectPassword: string | null;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
  owner: PersonRef;
  _count: { tasks: number };
}

export interface ProjectMember extends PersonRef {
  githubUsername: string | null;
}

export interface ProjectDetail extends Project {
  tasks: ProjectTask[];
  members: ProjectMember[];
  taskLists: TaskList[];
}

export type DealStage =
  | "NEW_LEAD"
  | "QUALIFIED"
  | "MEETING_SCHEDULED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "ARCHIVED";

export const DEAL_STAGES: DealStage[] = [
  "NEW_LEAD",
  "QUALIFIED",
  "MEETING_SCHEDULED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "ARCHIVED",
];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  NEW_LEAD: "New Lead",
  QUALIFIED: "Qualified",
  MEETING_SCHEDULED: "Meeting Scheduled",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
  ARCHIVED: "Archived",
};

export type LeadSource = "MANUAL" | "APOLLO" | "IMPORT";

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  notes: string | null;
  apolloId: string | null;
  linkedinUrl: string | null;
  employeeCount: number | null;
  source: LeadSource;
  createdAt: string;
  updatedAt: string;
  _count: { contacts: number; deals: number };
}

export interface CompanyDetail extends Company {
  contacts: (PersonRef & { email: string | null })[];
  deals: { id: string; title: string; stage: DealStage; value: number }[];
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  companyId: string | null;
  company: { id: string; name: string } | null;
  apolloId: string | null;
  linkedinUrl: string | null;
  source: LeadSource;
  enrichedAt: string | null;
  notes: string | null;
  location: string | null;
  website: string | null;
  category: string | null;
  priority: string | null;
  bulkEmailRecipients?: BulkEmailRecipient[];
  sequenceEnrollments?: SequenceEnrollment[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactImportBatch {
  id: string;
  fileName: string;
  importedBy: PersonRef;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  createdAt: string;
}

export type DealApprovalStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  position: number;
  companyId: string | null;
  company: { id: string; name: string } | null;
  contactId: string | null;
  contact: Pick<PersonRef, "id" | "firstName" | "lastName"> | null;
  ownerId: string;
  owner: PersonRef;
  notes: string | null;
  expectedCloseDate: string | null;
  closedAt: string | null;
  approvalStatus: DealApprovalStatus;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = "CALL" | "MEETING" | "NOTE" | "SYSTEM";

export const ACTIVITY_TYPES: ActivityType[] = ["CALL", "MEETING", "NOTE"];
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  NOTE: "Note",
  SYSTEM: "System Log",
};

export interface Activity {
  id: string;
  type: ActivityType;
  content: string;
  // Who was spoken to. Null on notes about nobody in particular, and on every
  // SYSTEM row (the server writes those with no one on the other end).
  contactId: string | null;
  contact: (Pick<PersonRef, "id" | "firstName" | "lastName"> & { email: string | null }) | null;
  outcome: string | null;
  durationMin: number | null;
  occurredAt: string;
  dealId: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  creator: PersonRef;
}

export interface ChatChannel {
  id: string;
  name: string | null;
  description: string | null;
  isDM: boolean;
  departmentId: string | null;
  dmUserId1: string | null;
  dmUserId2: string | null;
  dmUser1: PersonRef | null;
  dmUser2: PersonRef | null;
  department: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  channelId: string;
  senderId: string;
  sender: PersonRef;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesStats {
  openPipelineValue: number;
  wonThisMonth: { count: number; value: number };
  lostThisMonth: { count: number; value: number };
  winRateThisMonth: number | null;
  topOpenDeals: Deal[];
  revenueByMonth: { month: string; value: number }[];
}

export interface AnalyticsSummary {
  sales: {
    totalWonRevenue: number;
    closedCount: number;
    winRate: number;
    stageCounts: Record<string, number>;
    monthlyTrend: { month: string; value: number }[];
    leaderboard: { ownerId: string; name: string; value: number; count: number }[];
  };
  productivity: {
    totalTasks: number;
    completionRate: number;
    statusCounts: Record<string, number>;
    priorityCounts: Record<string, number>;
    leaderboard: { assigneeId: string; name: string; completedCount: number; totalCount: number }[];
    projectStatusCounts: Record<string, number>;
  };
  org: {
    totalEmployees: number;
    departments: { id: string; name: string; employeeCount: number; monthlyTarget: number | null }[];
  };
  dev: {
    velocityLeaderboard: { assigneeId: string; name: string; storyPoints: number }[];
    totalBugs: number;
    totalFeatures: number;
    qualityRatio: number;
  };
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "PLANNING" | "ACTIVE" | "COMPLETED";
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  departmentId: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface GitCommit {
  id: string;
  hash: string;
  message: string;
  branch: string;
  authorId: string;
  author: PersonRef;
  taskId: string | null;
  task: { id: string; taskNumber: number; title: string; status: TaskStatus } | null;
  isPR: boolean;
  prStatus: "OPEN" | "MERGED" | "CLOSED" | null;
  prNumber: number | null;
  buildStatus: "PENDING" | "SUCCESS" | "FAILURE" | null;
  createdAt: string;
}

export interface Epic {
  id: string;
  name: string;
  description: string | null;
  status: "PLANNING" | "IN_PROGRESS" | "COMPLETED";
  departmentId: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface Release {
  id: string;
  versionName: string;
  releaseDate: string | null;
  status: "PLANNED" | "RELEASED" | "FAILED";
  departmentId: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string | null;
  authorId: string;
  author: PersonRef;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Leave Management ───────────────────────────────────────────────────────

export type LeaveType =
  | "ANNUAL"
  | "SICK"
  | "CASUAL"
  | "UNPAID"
  | "MATERNITY_PATERNITY";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const LEAVE_TYPES: LeaveType[] = [
  "ANNUAL",
  "SICK",
  "CASUAL",
  "UNPAID",
  "MATERNITY_PATERNITY",
];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: "Annual Leave",
  SICK: "Sick Leave",
  CASUAL: "Casual Leave",
  UNPAID: "Unpaid Leave",
  MATERNITY_PATERNITY: "Maternity / Paternity",
};

export const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  ANNUAL: "#6366f1",       // indigo
  SICK: "#ef4444",         // red
  CASUAL: "#f59e0b",       // amber
  UNPAID: "#64748b",       // slate
  MATERNITY_PATERNITY: "#ec4899", // pink
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export interface LeaveRequest {
  id: string;
  userId: string;
  user: PersonRef;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  reason: string | null;
  reviewedById: string | null;
  reviewedBy: PersonRef | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byType: { type: LeaveType; count: number }[];
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationType =
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "TASK_ASSIGNED"
  | "TASK_UPDATED"
  | "GENERAL";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string; // ISO 8601 date string
}

// ─── Work Sessions ───────────────────────────────────────────────────────────

export interface WorkSession {
  id: string;
  userId: string;
  user: PersonRef;
  clockInAt: string; // ISO 8601 date string
  clockOutAt: string | null; // null if active
  durationMin: number | null; // calculated when clocked out
  date: string; // Midnight UTC of the clock-in date
  createdAt: string;
  updatedAt: string;
}

// ─── Zoho Projects & Bug Tracking ──────────────────────────────────────────

export type BugSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type BugPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type BugStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "TO_BE_TESTED"
  | "RETESTING"
  | "CLOSED"
  | "REOPENED";

export const BUG_SEVERITIES: BugSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const BUG_PRIORITIES: BugPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const BUG_STATUSES: BugStatus[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "TO_BE_TESTED",
  "RETESTING",
  "CLOSED",
  "REOPENED",
];

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  TO_BE_TESTED: "To Be Tested",
  RETESTING: "Retesting",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

export const BUG_SEVERITY_COLORS: Record<BugSeverity, string> = {
  LOW: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  MEDIUM: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  CRITICAL: "bg-red-500/10 text-red-400 border-red-500/20 font-bold",
};

export interface BugComment {
  id: string;
  bugId: string;
  userId: string;
  user: PersonRef;
  content: string;
  createdAt: string;
}

export interface BugActivityLog {
  id: string;
  bugId: string;
  userId: string;
  user: PersonRef;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface TaskActivityLog {
  id: string;
  taskId: string;
  userId: string;
  user: PersonRef;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface Bug {
  id: string;
  bugNumber: number;
  title: string;
  description: string | null;
  taskId: string;
  subtaskId: string | null;
  reporterId: string;
  reporter: PersonRef;
  assigneeId: string | null;
  assignee: PersonRef | null;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  attachments: string[];
  comments?: BugComment[];
  activityLogs?: BugActivityLog[];
  task?: { id: string; title: string; projectId: string | null; testerId: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssigneeEntry {
  id: string;
  taskId: string;
  userId: string;
  user: PersonRef;
  assignedAt: string;
}

export interface DetailedTaskUpdate {
  id: string;
  taskId: string;
  userId: string;
  user: PersonRef;
  content: string;
  date: string;
  workCompleted: string | null;
  nextPlan: string | null;
  blockers: string | null;
  notes: string | null;
  attachments: string[];
  createdAt: string;
}

export interface DetailedTimeLog {
  id: string;
  taskId: string;
  subtaskId: string | null;
  userId: string;
  user: PersonRef;
  date: string;
  startTime: string | null;
  endTime: string | null;
  minutes: number;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface ProjectTaskDetail {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  projectId: string | null;
  project: { id: string; name: string } | null;
  assigneeId: string | null;
  assignee: PersonRef | null;
  assignees: TaskAssigneeEntry[];
  testerId: string | null;
  tester: PersonRef | null;
  testingNotes: string | null;
  testingCompletedAt: string | null;
  testingApproved: boolean;
  creatorId: string;
  creator: PersonRef;
  dueDate: string | null;
  startDate: string | null;
  tags: string[];
  subtasks: ProjectTaskDetail[];
  updates: DetailedTaskUpdate[];
  timeLogs: DetailedTimeLog[];
  bugs: Bug[];
  activityLogs: TaskActivityLog[];
  parentId: string | null;
  _count?: { updates: number; bugs: number; subtasks: number; timeLogs: number };
  createdAt: string;
  updatedAt: string;
}



