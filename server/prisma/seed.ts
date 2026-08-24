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
  // Surnames not supplied at onboarding -- Admin/HR can fill them in from the
  // HRMS Portal. Blank rather than invented: these names appear as deal
  // owners and in the activity log, so a wrong one is worse than a missing one.
  { email: "anil@venusglobaltech.com", firstName: "Anil", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },
  { email: "srikanth@venushiring.com", firstName: "Srikanth", lastName: "", role: RoleName.EMPLOYEE, departmentName: "Sales", managerEmail: "jon@venushiring.com" },

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
