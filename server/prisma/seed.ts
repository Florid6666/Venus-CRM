import { PrismaClient, RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "ChangeMe123!";

// NOTE on "SEO": the SEO module is department-scoped to "Digital Marketing"
// (see the nav/route guards), so the SEO manager is the Digital Marketing
// department manager. HR keeps its own manager (not part of the org roster the
// product owner specified, but required for HR directory-management features).
const SEED_USERS: Array<{
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  departmentName: string;
  managerEmail?: string;
}> = [
  // --- Executive / Admin ---
  { email: "paresh@venusglobaltech.com", firstName: "Paresh", lastName: "Kumar", role: RoleName.ADMIN, departmentName: "Executive" },

  // --- Dev (manager: Jivan) + 3 employees ---
  { email: "manager@omnios.local", firstName: "Jivan", lastName: "Satapathy", role: RoleName.MANAGER, departmentName: "Dev" },
  { email: "debasish@omnios.local", firstName: "Debasish", lastName: "Sadangi", role: RoleName.EMPLOYEE, departmentName: "Dev", managerEmail: "manager@omnios.local" },
  { email: "subhram@omnios.local", firstName: "Subhram", lastName: "Behera", role: RoleName.EMPLOYEE, departmentName: "Dev", managerEmail: "manager@omnios.local" },
  { email: "pratyush@omnios.local", firstName: "Pratyush", lastName: "Nayak", role: RoleName.EMPLOYEE, departmentName: "Dev", managerEmail: "manager@omnios.local" },

  // --- Sales (manager: Jon) + 5 employees (3 named + 2 more) ---
  { email: "jon@venushiring.com", firstName: "Jon", lastName: "Carter", role: RoleName.MANAGER, departmentName: "Sales" },
  { email: "dip@omnios.local", firstName: "Dip", lastName: "Mishra", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },
  { email: "sourav@omnios.local", firstName: "Sourav", lastName: "Sahoo", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },
  { email: "divya@omnios.local", firstName: "Divya", lastName: "Menon", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },
  { email: "ankit@omnios.local", firstName: "Ankit", lastName: "Verma", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },
  { email: "priya@omnios.local", firstName: "Priya", lastName: "Nair", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },

  // --- Digital Marketing / SEO (manager: Shantanu) ---
  { email: "marketing.manager@omnios.local", firstName: "Shantanu", lastName: "Das", role: RoleName.MANAGER, departmentName: "Digital Marketing" },

  // --- Recruitment (manager: Megan) + 10 employees ---
  { email: "recruitment.manager@omnios.local", firstName: "Megan", lastName: "Foster", role: RoleName.MANAGER, departmentName: "Recruitment" },
  { email: "aditya@omnios.local", firstName: "Aditya", lastName: "Rao", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "sneha@omnios.local", firstName: "Sneha", lastName: "Kapoor", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "rohit@omnios.local", firstName: "Rohit", lastName: "Jena", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "ananya@omnios.local", firstName: "Ananya", lastName: "Iyer", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "karan@omnios.local", firstName: "Karan", lastName: "Malhotra", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "meera@omnios.local", firstName: "Meera", lastName: "Pillai", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "vikram@omnios.local", firstName: "Vikram", lastName: "Singh", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "nisha@omnios.local", firstName: "Nisha", lastName: "Patel", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "arjun@omnios.local", firstName: "Arjun", lastName: "Reddy", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },
  { email: "riya@omnios.local", firstName: "Riya", lastName: "Sen", role: RoleName.EMPLOYEE, departmentName: "Recruitment", managerEmail: "recruitment.manager@omnios.local" },

  // --- HR (manager: Hana) ---
  { email: "vhr@venushiring.ca", firstName: "Hana", lastName: "Resources", role: RoleName.MANAGER, departmentName: "HR" },
];

const SEED_DEPARTMENTS: Array<{ name: string; description: string; managerTitle: string; headEmail: string }> = [
  { name: "Executive", description: "Company leadership", managerTitle: "Manager", headEmail: "paresh@venusglobaltech.com" },
  { name: "Dev", description: "Product engineering", managerTitle: "Head", headEmail: "manager@omnios.local" },
  { name: "Sales", description: "Sales team", managerTitle: "Manager", headEmail: "jon@venushiring.com" },
  { name: "Digital Marketing", description: "Digital marketing & SEO team", managerTitle: "Manager", headEmail: "marketing.manager@omnios.local" },
  { name: "Recruitment", description: "Recruitment team", managerTitle: "Manager", headEmail: "recruitment.manager@omnios.local" },
  { name: "HR", description: "Human resources", managerTitle: "Manager", headEmail: "vhr@venushiring.ca" },
];

async function main() {
  // Full reset -- clear all data (children before parents for FK safety) so
  // the roster below is the deterministic state after seeding.
  console.log("Cleaning existing database records...");
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatChannel.deleteMany();
  await prisma.kBArticle.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.gitCommit.deleteMany();
  await prisma.seoContentBrief.deleteMany();
  await prisma.seoBacklink.deleteMany();
  await prisma.seoCompetitor.deleteMany();
  await prisma.seoAudit.deleteMany();
  await prisma.seoKeyword.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.epic.deleteMany();
  await prisma.release.deleteMany();
  await prisma.project.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.appSettings.deleteMany();
  await prisma.githubConnection.deleteMany();

  console.log("Seeding system roles...");
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log("Seeding users...");
  const userIdByEmail = new Map<string, string>();
  for (const user of SEED_USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: roleIdByName.get(user.role)!,
        isActive: true,
        passwordHash,
      },
      create: {
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: roleIdByName.get(user.role)!,
      },
    });
    userIdByEmail.set(user.email, record.id);
  }

  // Prune any users that are no longer part of the roster (e.g. accounts from
  // an earlier seed). Safe because all data referencing users was cleared above.
  const seedEmails = SEED_USERS.map((u) => u.email);
  const pruned = await prisma.user.deleteMany({ where: { email: { notIn: seedEmails } } });
  if (pruned.count > 0) {
    console.log(`Pruned ${pruned.count} user(s) no longer in the roster.`);
  }

  // Handle legacy department name migration if an old DB exists.
  const legacyEngineering = await prisma.department.findUnique({ where: { name: "Engineering" } });
  if (legacyEngineering) {
    await prisma.department.update({ where: { id: legacyEngineering.id }, data: { name: "Dev" } });
  }

  console.log("Seeding departments...");
  const departmentIdByName = new Map<string, string>();
  for (const dept of SEED_DEPARTMENTS) {
    const headId = userIdByEmail.get(dept.headEmail);
    const record = await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description, managerTitle: dept.managerTitle, headId },
      create: { name: dept.name, description: dept.description, managerTitle: dept.managerTitle, headId },
    });
    departmentIdByName.set(dept.name, record.id);
  }

  // Set user department + manager relations.
  for (const user of SEED_USERS) {
    await prisma.user.update({
      where: { email: user.email },
      data: {
        departmentId: departmentIdByName.get(user.departmentName),
        managerId: user.managerEmail ? userIdByEmail.get(user.managerEmail) : null,
      },
    });
  }

  console.log("Seeding default general chat channel...");
  await prisma.chatChannel.upsert({
    where: { id: "default-channel-general" },
    create: {
      id: "default-channel-general",
      name: "general",
      description: "Company-wide announcements and chat",
      isDM: false,
    },
    update: {},
  });

  console.log("Seeding sample Projects, Tasks, Subtasks, Daily Updates, Time Logs, and Bugs...");
  const devDeptId = departmentIdByName.get("Dev");
  const adminId = userIdByEmail.get("paresh@venusglobaltech.com")!;
  const managerId = userIdByEmail.get("manager@omnios.local")!;
  const dev1Id = userIdByEmail.get("debasish@omnios.local")!;
  const dev2Id = userIdByEmail.get("subhram@omnios.local")!;
  const dev3Id = userIdByEmail.get("pratyush@omnios.local")!;

  const project = await prisma.project.create({
    data: {
      name: "Venus CRM",
      description: "Zoho Projects-Inspired Enterprise CRM & Project Operating System",
      status: "ACTIVE",
      ownerId: adminId,
      departmentId: devDeptId,
      members: { connect: [{ id: adminId }, { id: managerId }, { id: dev1Id }, { id: dev2Id }, { id: dev3Id }] },
    },
  });

  // Task 1: Lead Management Module (Multiple assignees)
  const task1 = await prisma.task.create({
    data: {
      title: "Lead Management Module",
      description: "Build lead capture, deduplication, search filters, and pipeline views.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      projectId: project.id,
      assigneeId: dev1Id,
      testerId: managerId,
      creatorId: managerId,
      departmentId: devDeptId,
      startDate: new Date("2026-08-20"),
      dueDate: new Date("2026-08-30"),
      assignees: {
        create: [{ userId: dev1Id }, { userId: dev2Id }],
      },
    },
  });

  // Subtask 1 for Task 1
  const sub1 = await prisma.task.create({
    data: {
      title: "User CRUD APIs",
      description: "Develop REST endpoints for leads CRUD and filtering.",
      status: "DONE",
      priority: "HIGH",
      projectId: project.id,
      parentId: task1.id,
      assigneeId: dev1Id,
      testerId: managerId,
      creatorId: managerId,
      departmentId: devDeptId,
    },
  });

  // Subtask 2 for Task 1
  const sub2 = await prisma.task.create({
    data: {
      title: "User Interface Development",
      description: "Build Kanban cards and list layout for Lead Management.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      projectId: project.id,
      parentId: task1.id,
      assigneeId: dev2Id,
      testerId: managerId,
      creatorId: managerId,
      departmentId: devDeptId,
    },
  });

  // Task 2: Customer Dashboard (Multiple assignees)
  const task2 = await prisma.task.create({
    data: {
      title: "Customer Dashboard",
      description: "Integrate analytics summary charts, recent lead activities, and metrics widgets.",
      status: "READY_FOR_TESTING",
      priority: "HIGH",
      projectId: project.id,
      assigneeId: dev2Id,
      testerId: managerId,
      creatorId: managerId,
      departmentId: devDeptId,
      startDate: new Date("2026-08-18"),
      dueDate: new Date("2026-08-25"),
      assignees: {
        create: [{ userId: dev2Id }, { userId: dev3Id }],
      },
    },
  });

  // Seed Daily Updates
  await prisma.taskUpdate.create({
    data: {
      taskId: task1.id,
      userId: dev1Id,
      content: "Finished customer listing API and filter endpoint.",
      workCompleted: "Finished customer listing API.",
      nextPlan: "Implement filtering and search optimization.",
      blockers: "Waiting for approval on API schema.",
      notes: "Tested locally with Postman.",
    },
  });

  await prisma.taskUpdate.create({
    data: {
      taskId: task2.id,
      userId: dev2Id,
      content: "Integrated dashboard analytics widgets with backend metrics.",
      workCompleted: "Created dashboard widgets and integrated APIs.",
      nextPlan: "Pass to QA testing.",
      blockers: "None",
    },
  });

  // Seed Time Logs
  await prisma.timeLog.create({
    data: {
      taskId: task1.id,
      subtaskId: sub1.id,
      userId: dev1Id,
      date: new Date("2026-08-22"),
      startTime: "10:00 AM",
      endTime: "01:00 PM",
      minutes: 180,
      note: "Created Lead CRUD APIs and database queries.",
      status: "APPROVED",
    },
  });

  await prisma.timeLog.create({
    data: {
      taskId: task2.id,
      userId: dev2Id,
      date: new Date("2026-08-22"),
      startTime: "02:00 PM",
      endTime: "05:30 PM",
      minutes: 210,
      note: "Dashboard widget layout and responsive UI styling.",
      status: "PENDING",
    },
  });

  // Seed Bugs
  const bug1 = await prisma.bug.create({
    data: {
      bugNumber: 1,
      title: "Search not working on Lead filters",
      description: "When entering search query in Lead Management search input, filtered results do not update.",
      taskId: task1.id,
      subtaskId: sub1.id,
      reporterId: managerId,
      assigneeId: dev1Id,
      severity: "HIGH",
      priority: "HIGH",
      status: "OPEN",
    },
  });

  const bug2 = await prisma.bug.create({
    data: {
      bugNumber: 2,
      title: "Duplicate lead creation on double click",
      description: "Submitting form rapidly twice creates duplicate lead entries.",
      taskId: task1.id,
      reporterId: managerId,
      assigneeId: dev2Id,
      severity: "MEDIUM",
      priority: "MEDIUM",
      status: "TO_BE_TESTED",
    },
  });

  const bug3 = await prisma.bug.create({
    data: {
      bugNumber: 3,
      title: "Validation error missing on empty email",
      description: "Validation feedback text missing on email input.",
      taskId: task2.id,
      reporterId: managerId,
      assigneeId: dev3Id,
      severity: "LOW",
      priority: "LOW",
      status: "CLOSED",
    },
  });

  // Seed Bug Comments & Logs
  await prisma.bugComment.create({
    data: {
      bugId: bug1.id,
      userId: managerId,
      content: "Discovered during QA validation testing. Please check query params parsing.",
    },
  });

  await prisma.bugActivityLog.create({
    data: {
      bugId: bug1.id,
      userId: managerId,
      action: "BUG_CREATED",
      details: "Bug created with status OPEN",
    },
  });

  await prisma.taskActivityLog.create({
    data: {
      taskId: task1.id,
      userId: managerId,
      action: "BUG_CREATED",
      details: 'Bug #1: "Search not working on Lead filters" logged.',
    },
  });

  console.log("Seeding complete!");
  console.log("Seeded users (all password: " + SEED_PASSWORD + "):");
  for (const user of SEED_USERS) {
    console.log(
      `  ${user.departmentName.padEnd(18)} ${user.role.padEnd(8)} ${(user.firstName + " " + user.lastName).padEnd(20)} ${user.email}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
