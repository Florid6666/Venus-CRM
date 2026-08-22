import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { canManageDirectory } from "../../common/utils/directory-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Mirrors auth.service.ts's normalizeEmail -- keeps stored emails
// consistent with how login looks them up.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  githubUsername: true,
  isActive: true,
  monthlyTarget: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
  department: { select: { id: true, name: true, managerTitle: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ select: userSelect, orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async create(dto: CreateUserDto, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    // Only a real Admin may mint another Admin -- HR can onboard/manage
    // Managers and Employees, but must not be able to escalate to Admin.
    this.assertNotGrantingAdmin(actor, dto.role);

    // Normalize casing before both the uniqueness check and the insert --
    // login does a case-insensitive-normalized lookup (see auth.service.ts),
    // so a stored "John@x.com" next to an existing "john@x.com" would create
    // two accounts that look identical to whoever's trying to log into
    // either of them.
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("Email already in use");
    }
    if (dto.departmentId) {
      await this.assertDepartmentExists(dto.departmentId);
    }
    if (dto.managerId) {
      await this.assertUserExists(dto.managerId);
    }

    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: dto.role } });
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl,
        githubUsername: dto.githubUsername,
        roleId: role.id,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
        monthlyTarget: dto.monthlyTarget,
      },
      select: userSelect,
    });
  }

  // Self-service profile edit -- a user updating their OWN name/avatar only.
  // Email (login identifier) is never changeable; password goes through the
  // emailed reset-link flow, not here.
  async updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl,
      },
      select: userSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    const target = await this.findOne(id);
    // A non-Admin directory manager (HR) can't touch an existing Admin, nor
    // promote anyone to Admin.
    if (actor.role.name !== RoleName.ADMIN && target.role.name === RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can modify an admin account");
    }
    this.assertNotGrantingAdmin(actor, dto.role);

    let roleId: string | undefined;
    if (dto.role) {
      const role = await this.prisma.role.findUniqueOrThrow({ where: { name: dto.role } });
      roleId = role.id;
    }
    if (dto.departmentId) {
      await this.assertDepartmentExists(dto.departmentId);
    }
    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestException("A user cannot be their own manager");
      }
      await this.assertUserExists(dto.managerId);
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl,
        isActive: dto.isActive,
        roleId,
        passwordHash,
        githubUsername: dto.githubUsername,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
        monthlyTarget: dto.monthlyTarget,
      },
      select: userSelect,
    });
  }

  async updateTarget(id: string, monthlyTarget: number | null, user: RequestUser) {
    const targetUser = await this.findOne(id);

    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      targetUser.department?.id === user.department?.id;
    const isAdmin = user.role.name === RoleName.ADMIN;

    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to update targets for this user");
    }

    return this.prisma.user.update({
      where: { id },
      data: { monthlyTarget },
      select: userSelect,
    });
  }

  async updateGithubUsername(id: string, githubUsername: string | null, user: RequestUser) {
    await this.findOne(id);

    const isAdmin = user.role.name === RoleName.ADMIN;
    const isSelf = user.id === id;
    if (!isAdmin && !isSelf) {
      throw new ForbiddenException("You can only link your own GitHub account");
    }

    if (githubUsername) {
      const existing = await this.prisma.user.findUnique({ where: { githubUsername } });
      if (existing && existing.id !== id) {
        throw new ConflictException("That GitHub username is already linked to another account");
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { githubUsername },
      select: userSelect,
    });
  }

  // TODO: revisit -- no manager-chain cycle detection (A->B->C->A) yet, just the
  // direct self-manager check above. Disproportionate to this phase's scope.
  private async assertDepartmentExists(departmentId: string) {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Manager not found");
    }
  }

  async deactivate(id: string, actor: RequestUser) {
    this.assertCanManageDirectory(actor);
    const target = await this.findOne(id);
    if (actor.role.name !== RoleName.ADMIN && target.role.name === RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can deactivate an admin account");
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect,
    });
  }

  private assertCanManageDirectory(actor: RequestUser) {
    if (!canManageDirectory(actor)) {
      throw new ForbiddenException("You do not have permission to manage the employee directory");
    }
  }

  private assertNotGrantingAdmin(actor: RequestUser, role: RoleName | undefined) {
    if (actor.role.name !== RoleName.ADMIN && role === RoleName.ADMIN) {
      throw new ForbiddenException("Only an admin can grant the Admin role");
    }
  }
}
