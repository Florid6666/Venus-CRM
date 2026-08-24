import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSeoKeywordDto } from "./dto/create-seo-keyword.dto";
import { UpdateSeoKeywordDto } from "./dto/update-seo-keyword.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const seoKeywordInclude = {
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class SeoKeywordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeoKeywordDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("SEO keywords must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a keyword for another department");
    }

    return this.prisma.seoKeyword.create({
      data: {
        term: dto.term,
        searchIntent: dto.searchIntent,
        volume: dto.volume,
        difficulty: dto.difficulty,
        currentRank: dto.currentRank,
        targetRank: dto.targetRank,
        url: dto.url,
        projectId: dto.projectId,
        campaignId: dto.campaignId,
        departmentId,
      },
      include: seoKeywordInclude,
    });
  }

  async findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }

    const where: Prisma.SeoKeywordWhereInput = scopedDepartmentId
      ? { departmentId: scopedDepartmentId }
      : {};

    // Non-Admin, non-Manager EMPLOYEEs only see department-wide (no-project)
    // keywords plus keywords for projects they're a member of.
    if (user.role.name === RoleName.EMPLOYEE) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { memberOfProjects: { select: { id: true } } },
      });
      const allowedProjectIds = dbUser?.memberOfProjects.map((p) => p.id) ?? [];
      where.OR = [
        { projectId: null },
        ...(allowedProjectIds.length > 0 ? [{ projectId: { in: allowedProjectIds } }] : []),
      ];
    }

    return this.prisma.seoKeyword.findMany({
      where,
      include: seoKeywordInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const keyword = await this.prisma.seoKeyword.findUnique({
      where: { id },
      include: seoKeywordInclude,
    });
    if (!keyword) {
      throw new NotFoundException("SEO keyword not found");
    }
    this.assertCanAccess(keyword, user);
    return keyword;
  }

  async update(id: string, dto: UpdateSeoKeywordDto, user: RequestUser) {
    const keyword = await this.getOwned(id);
    this.assertCanMutate(keyword, user);
    return this.prisma.seoKeyword.update({ where: { id }, data: dto, include: seoKeywordInclude });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const keyword = await this.getOwned(id);
    this.assertCanMutate(keyword, user);
    await this.prisma.seoKeyword.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const keyword = await this.prisma.seoKeyword.findUnique({ where: { id } });
    if (!keyword) {
      throw new NotFoundException("SEO keyword not found");
    }
    return keyword;
  }

  private assertCanAccess(keyword: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && keyword.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's SEO keywords");
    }
  }

  private assertCanMutate(keyword: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager =
      user.role.name === RoleName.MANAGER && keyword.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify SEO keywords");
    }
  }
}
