import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSeoBacklinkDto } from "./dto/create-seo-backlink.dto";
import { UpdateSeoBacklinkDto } from "./dto/update-seo-backlink.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const seoBacklinkInclude = {
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class SeoBacklinksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeoBacklinkDto, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const departmentId = dto.departmentId ?? user.department?.id;
    if (!departmentId) {
      throw new ForbiddenException("SEO backlinks must belong to a specific department");
    }
    if (!isAdmin && departmentId !== user.department?.id) {
      throw new ForbiddenException("You cannot create a backlink for another department");
    }

    return this.prisma.seoBacklink.create({
      data: {
        sourceUrl: dto.sourceUrl,
        targetUrl: dto.targetUrl,
        domainAuthority: dto.domainAuthority,
        status: dto.status,
        departmentId,
      },
      include: seoBacklinkInclude,
    });
  }

  findAll(departmentId: string | undefined, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const scopedDepartmentId = isAdmin ? departmentId : user.department?.id;
    if (!isAdmin && !scopedDepartmentId) {
      return [];
    }
    return this.prisma.seoBacklink.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : undefined,
      include: seoBacklinkInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const backlink = await this.prisma.seoBacklink.findUnique({ where: { id }, include: seoBacklinkInclude });
    if (!backlink) {
      throw new NotFoundException("SEO backlink not found");
    }
    this.assertCanAccess(backlink, user);
    return backlink;
  }

  async update(id: string, dto: UpdateSeoBacklinkDto, user: RequestUser) {
    const backlink = await this.getOwned(id);
    this.assertCanMutate(backlink, user);
    return this.prisma.seoBacklink.update({ where: { id }, data: dto, include: seoBacklinkInclude });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const backlink = await this.getOwned(id);
    this.assertCanMutate(backlink, user);
    await this.prisma.seoBacklink.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const backlink = await this.prisma.seoBacklink.findUnique({ where: { id } });
    if (!backlink) {
      throw new NotFoundException("SEO backlink not found");
    }
    return backlink;
  }

  private assertCanAccess(backlink: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && backlink.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this department's SEO backlinks");
    }
  }

  private assertCanMutate(backlink: { departmentId: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isDeptManager = user.role.name === RoleName.MANAGER && backlink.departmentId === user.department?.id;
    if (!isAdmin && !isDeptManager) {
      throw new ForbiddenException("Only a Manager or Admin can modify SEO backlinks");
    }
  }
}
