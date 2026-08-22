import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateEmailTemplateDto } from "./dto/create-email-template.dto";
import { UpdateEmailTemplateDto } from "./dto/update-email-template.dto";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

const templateInclude = {
  creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.emailTemplate.findMany({
      include: templateInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
      include: templateInclude,
    });
    if (!template) {
      throw new NotFoundException("Email template not found");
    }
    return template;
  }

  create(dto: CreateEmailTemplateDto, user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.emailTemplate.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        appendSignature: dto.appendSignature,
        creatorId: user.id,
        departmentId: user.department?.id,
      },
      include: templateInclude,
    });
  }

  async update(id: string, dto: UpdateEmailTemplateDto, user: RequestUser) {
    this.assertCanUse(user);
    await this.getOwned(id);
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        appendSignature: dto.appendSignature,
      },
      include: templateInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    this.assertCanUse(user);
    await this.getOwned(id);
    await this.prisma.emailTemplate.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException("Email template not found");
    }
    return template;
  }

  // Templates are a shared Sales-team resource (any Sales member can
  // create/edit/delete any template), same collaborative convention as the
  // recruitment candidate pipeline -- not owner-scoped like Task/Deal.
  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Email templates are only available to the Sales department");
    }
  }
}
