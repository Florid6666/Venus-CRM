import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { createConnection } from "node:net";
import { PrismaService } from "../../prisma/prisma.service";
import { ConnectEmailDto } from "./dto/connect-email.dto";
import { encryptSecret, decryptSecret } from "../../common/utils/token-crypto";
import { hasHttpMailProvider } from "../../common/utils/mailer";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

export type SendableSender =
  | { mode: "smtp"; transporter: nodemailer.Transporter; from: string }
  | { mode: "http"; replyTo: string };

export interface NetworkDiagnosticResult {
  label: string;
  host: string;
  port: number;
  ok: boolean;
  ms: number;
  error?: string;
}

// Fixed, hardcoded targets only (the same providers PROVIDER_PRESETS on the
// frontend offers) -- never a user-supplied host/port, so this can't be used
// as an arbitrary internal-network port probe.
const DIAGNOSTIC_TARGETS: Array<{ label: string; host: string; port: number }> = [
  { label: "Zoho (465, TLS)", host: "smtp.zoho.com", port: 465 },
  { label: "Zoho (587, STARTTLS)", host: "smtp.zoho.com", port: 587 },
  { label: "Gmail (465, TLS)", host: "smtp.gmail.com", port: 465 },
  { label: "Outlook (587, STARTTLS)", host: "smtp.office365.com", port: 587 },
];

export interface EmailConnectionStatus {
  connected: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUsername: string | null;
  fromName: string | null;
  fromEmail: string | null;
  verified: boolean;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  // Whether the shared HTTP stopgap sender (see requireSendable) is
  // available, so the frontend can explain that sending will still work
  // (via a shared address with Reply-To set to the user) even without a
  // verified SMTP connection.
  httpFallbackAvailable: boolean;
}

const NOT_CONNECTED: Omit<EmailConnectionStatus, "httpFallbackAvailable"> = {
  connected: false,
  smtpHost: null,
  smtpPort: null,
  smtpSecure: null,
  smtpUsername: null,
  fromName: null,
  fromEmail: null,
  verified: false,
  lastVerifiedAt: null,
  lastError: null,
};

@Injectable()
export class EmailConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(user: RequestUser): Promise<EmailConnectionStatus> {
    this.assertCanUse(user);
    const conn = await this.prisma.userEmailConnection.findUnique({ where: { userId: user.id } });
    const httpFallbackAvailable = hasHttpMailProvider();
    if (!conn) return { ...NOT_CONNECTED, httpFallbackAvailable };
    return {
      connected: true,
      smtpHost: conn.smtpHost,
      smtpPort: conn.smtpPort,
      smtpSecure: conn.smtpSecure,
      smtpUsername: conn.smtpUsername,
      fromName: conn.fromName,
      fromEmail: conn.fromEmail,
      verified: conn.verified,
      lastVerifiedAt: conn.lastVerifiedAt,
      lastError: conn.lastError,
      httpFallbackAvailable,
    };
  }

  // Verifies the SMTP credentials actually work (a real connection + auth
  // handshake, not just "looks well-formed") before ever persisting them --
  // a bad password saved as "connected" would silently fail every send
  // later instead of failing loudly here, once, with an actionable message.
  async connect(user: RequestUser, dto: ConnectEmailDto): Promise<EmailConnectionStatus> {
    this.assertCanUse(user);

    let password = dto.smtpPassword;
    if (!password) {
      const existing = await this.prisma.userEmailConnection.findUnique({ where: { userId: user.id } });
      if (!existing) {
        throw new BadRequestException("Password is required for a new connection");
      }
      password = decryptSecret({
        ciphertext: existing.encryptedPassword,
        iv: existing.passwordIv,
        authTag: existing.passwordAuthTag,
      });
    }

    const result = await this.verifyCredentials({
      host: dto.smtpHost,
      port: dto.smtpPort,
      secure: dto.smtpSecure,
      username: dto.smtpUsername,
      password,
    });
    if (!result.ok) {
      throw new BadRequestException(`Couldn't connect to that mail server: ${result.error}`);
    }

    const encrypted = encryptSecret(password);
    const data = {
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpSecure: dto.smtpSecure,
      smtpUsername: dto.smtpUsername,
      encryptedPassword: encrypted.ciphertext,
      passwordIv: encrypted.iv,
      passwordAuthTag: encrypted.authTag,
      fromName: dto.fromName,
      fromEmail: dto.fromEmail,
      verified: true,
      lastVerifiedAt: new Date(),
      lastError: null,
    };
    await this.prisma.userEmailConnection.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return this.getStatus(user);
  }

  // Re-checks a previously-saved connection without needing the password
  // re-entered -- decrypts what's on file and re-runs the same handshake.
  async test(user: RequestUser): Promise<EmailConnectionStatus> {
    this.assertCanUse(user);
    const conn = await this.prisma.userEmailConnection.findUnique({ where: { userId: user.id } });
    if (!conn) {
      throw new NotFoundException("No email connection on file yet -- connect one first.");
    }
    const password = decryptSecret({
      ciphertext: conn.encryptedPassword,
      iv: conn.passwordIv,
      authTag: conn.passwordAuthTag,
    });
    const result = await this.verifyCredentials({
      host: conn.smtpHost,
      port: conn.smtpPort,
      secure: conn.smtpSecure,
      username: conn.smtpUsername,
      password,
    });

    await this.prisma.userEmailConnection.update({
      where: { userId: user.id },
      data: {
        verified: result.ok,
        lastVerifiedAt: result.ok ? new Date() : conn.lastVerifiedAt,
        lastError: result.ok ? null : result.error,
      },
    });
    return this.getStatus(user);
  }

  async disconnect(user: RequestUser): Promise<void> {
    this.assertCanUse(user);
    await this.prisma.userEmailConnection.deleteMany({ where: { userId: user.id } });
  }

  // Used by the bulk-email and sequence send engines to resolve how to send
  // for whichever user owns the campaign/enrollment being processed.
  // Prefers the user's own verified SMTP mailbox (recipients see and can
  // reply to them directly). Falls back to the shared HTTP provider
  // (Resend/SendGrid, see common/utils/mailer.ts) with Reply-To set to the
  // sender's real CRM account email when no SMTP connection is on file --
  // a stopgap for hosts that block raw SMTP egress entirely (this one
  // currently does; see the "Test server network" diagnostic on the Bulk
  // Email Sender page), since nobody could otherwise ever pass the
  // Connect-and-verify step to get an SMTP row saved in the first place.
  // Throws rather than returning null/undefined so callers can't
  // accidentally treat "nothing configured" as "nothing to send" -- it
  // should always surface as a visible failure.
  async requireSendable(userId: string): Promise<SendableSender> {
    const conn = await this.prisma.userEmailConnection.findUnique({ where: { userId } });
    if (conn?.verified) {
      const password = decryptSecret({
        ciphertext: conn.encryptedPassword,
        iv: conn.passwordIv,
        authTag: conn.passwordAuthTag,
      });
      const transporter = nodemailer.createTransport({
        host: conn.smtpHost,
        port: conn.smtpPort,
        secure: conn.smtpSecure,
        auth: { user: conn.smtpUsername, pass: password },
      });
      const from = conn.fromName ? `${conn.fromName} <${conn.fromEmail}>` : conn.fromEmail;
      return { mode: "smtp", transporter, from };
    }

    if (hasHttpMailProvider()) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user) {
        throw new BadRequestException("Sender not found");
      }
      return { mode: "http", replyTo: user.email };
    }

    throw new BadRequestException("Sender has not connected a verified email account");
  }

  // Used by BulkEmailService/SequencesService's create/enroll pre-checks --
  // lets a campaign be created or contacts be enrolled even before a user
  // has (or, right now, even could) connect SMTP, as long as the shared HTTP
  // stopgap is configured. See requireSendable above for the send-time
  // counterpart.
  hasHttpFallback(): boolean {
    return hasHttpMailProvider();
  }

  // Raw TCP connect only -- no auth, no TLS handshake -- so it isolates
  // "can this server even reach the mail host on this port" from "did the
  // credentials/TLS negotiation work". Distinguishes a network-level block
  // (this server's host blocking egress, or the mail provider silently
  // dropping connections from a datacenter IP) from an account-level one
  // (bad credentials, SMTP access disabled) when a Connect/Test attempt
  // times out and it isn't obvious which side is at fault.
  async networkDiagnostic(user: RequestUser): Promise<NetworkDiagnosticResult[]> {
    this.assertCanUse(user);
    return Promise.all(DIAGNOSTIC_TARGETS.map((target) => this.probeTcp(target)));
  }

  private probeTcp(target: { label: string; host: string; port: number }): Promise<NetworkDiagnosticResult> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = createConnection({ host: target.host, port: target.port, timeout: 8_000 });
      const finish = (ok: boolean, error?: string) => {
        socket.destroy();
        resolve({ ...target, ok, ms: Date.now() - start, error });
      };
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false, "Timed out"));
      socket.once("error", (err) => finish(false, err instanceof Error ? err.message : String(err)));
    });
  }

  private async verifyCredentials(opts: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: { user: opts.username, pass: opts.password },
      connectionTimeout: 10_000,
    });
    try {
      await transporter.verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      transporter.close();
    }
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Email connections are only available to the Sales department");
    }
  }
}
