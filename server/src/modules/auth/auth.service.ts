import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthEventType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { parseTtlMs } from "../../common/utils/parse-ttl";
import { toRequestUser } from "../../common/utils/to-request-user";
import { sendEmail } from "../../common/utils/mailer";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const LOGIN_EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Emails are stored lowercase everywhere in this app (seed.ts, user
// creation), but a Postgres exact match is case-sensitive -- normalize any
// incoming email the same way before comparing against a stored row.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

// Best-effort request metadata attached to a login/logout audit event.
export interface AuthEventContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<RequestUser> {
    // Emails are stored lowercase (see seed.ts / user creation) but a
    // Postgres exact match is case-sensitive -- without this, "Jon@..."
    // fails to match a stored "jon@..." row and silently looks like a wrong
    // password instead of a case mismatch.
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: { role: true, department: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return toRequestUser(user);
  }

  private signAccessToken(user: RequestUser): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role.name },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
      },
    );
  }

  private async issueRefreshToken(userId: string): Promise<{ raw: string; expiresAt: Date }> {
    const raw = randomBytes(64).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const ttlMs = parseTtlMs(this.config.get<string>("JWT_REFRESH_TTL", "30d"));
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    return { raw, expiresAt };
  }

  async login(
    email: string,
    password: string,
    context: AuthEventContext = {},
  ): Promise<{ user: RequestUser } & AuthTokens> {
    const user = await this.validateCredentials(email, password);
    const accessToken = this.signAccessToken(user);
    const { raw, expiresAt } = await this.issueRefreshToken(user.id);

    await this.recordAuthEvent(user.id, AuthEventType.LOGIN, context);

    return { user, accessToken, refreshToken: raw, refreshTokenExpiresAt: expiresAt };
  }

  // Fire-and-forget audit record; a logging failure must never block sign-in or
  // sign-out, so failures are swallowed (the event is best-effort).
  private async recordAuthEvent(userId: string, type: AuthEventType, context: AuthEventContext) {
    try {
      await this.prisma.loginEvent.create({
        data: {
          userId,
          type,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null,
        },
      });
      // Opportunistic retention: occasionally purge events past the 90-day
      // window. Runs on a fraction of writes (not every one) so it costs almost
      // nothing, and the delete is bounded by the createdAt index.
      if (Math.random() < 0.05) {
        await this.prisma.loginEvent.deleteMany({
          where: { createdAt: { lt: new Date(Date.now() - LOGIN_EVENT_RETENTION_MS) } },
        });
      }
    } catch {
      // ignore -- auditing is non-critical to the auth flow
    }
  }

  async refresh(rawToken: string): Promise<{ user: RequestUser } & AuthTokens> {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true, department: true } } },
    });

    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt.getTime() < Date.now() ||
      !existing.user.isActive
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Rotate: revoke the presented token so it can't be replayed.
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const user: RequestUser = toRequestUser(existing.user);

    const accessToken = this.signAccessToken(user);
    const { raw, expiresAt } = await this.issueRefreshToken(user.id);

    return { user, accessToken, refreshToken: raw, refreshTokenExpiresAt: expiresAt };
  }

  async logout(rawToken: string, context: AuthEventContext = {}): Promise<void> {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    // Resolve the owning user before revoking so we can attribute the LOGOUT
    // audit event.
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (token) {
      await this.recordAuthEvent(token.userId, AuthEventType.LOGOUT, context);
    }
  }

  // Always resolves the same way regardless of whether the email exists, so
  // the endpoint can't be used to enumerate accounts. If the user exists and
  // is active, a single-use, 1-hour reset token is created and emailed.
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user || !user.isActive) {
      return;
    }

    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    await this.prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    const appUrl =
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("CORS_ORIGIN") ??
      "http://localhost:8080";
    const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${raw}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Venus CRM password",
      html: `<p>Hi ${user.firstName},</p>
<p>We received a request to reset your Venus CRM password. Click the link below to choose a new one. This link expires in 1 hour and can be used once.</p>
<p><a href="${resetUrl}">Reset my password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
      text: `Reset your Venus CRM password: ${resetUrl} (expires in 1 hour)`,
    });
  }

  // Validates the single-use token, sets the new password, consumes the token,
  // and revokes every existing refresh session (forces re-login everywhere).
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This reset link is invalid or has expired. Request a new one.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
