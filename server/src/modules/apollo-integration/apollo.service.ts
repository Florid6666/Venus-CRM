import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LeadSource, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ApolloConnectionService, APOLLO_API } from "./apollo-connection.service";
import { ApolloOrganizationSearchDto, ApolloPeopleSearchDto } from "./dto/apollo-search.dto";
import { ImportApolloOrganizationsDto, ImportApolloPeopleDto } from "./dto/import-apollo.dto";
import { canUseSalesOutreach } from "../../common/utils/sales-access";
import type { RequestUser } from "../../common/types/request-user.type";

// Apollo's search endpoints return a cheap, obfuscated PREVIEW (no email, no
// organization id, last name partially masked) -- full contact/org data only
// comes back from the "reveal" endpoints (people/match, organizations/enrich),
// which cost Apollo credits. So: browsing a search is free, and only
// import/enrich (an explicit user action) ever calls the reveal endpoints.
export interface ApolloPersonPreview {
  apolloId: string;
  firstName: string;
  lastNamePreview: string | null; // real last name if Apollo already exposed it, else an obfuscated hint (e.g. "Pr***i"), else null
  title: string | null;
  organizationName: string | null;
}

export interface ApolloOrganizationPreview {
  apolloId: string | null; // absent on unrevealed company-search results
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
}

export interface ApolloOrganizationDetail {
  apolloId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  linkedinUrl: string | null;
}

export interface ApolloPersonDetail {
  apolloId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  organization: ApolloOrganizationDetail | null;
}

@Injectable()
export class ApolloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connection: ApolloConnectionService,
  ) {}

  async searchPeople(filters: ApolloPeopleSearchDto, user: RequestUser): Promise<ApolloPersonPreview[]> {
    this.assertCanUse(user);

    return this.cached("people-search", filters, async () => {
      const apiKey = await this.connection.requireApiKey();
      const res = await this.apolloFetch("/mixed_people/api_search", apiKey, {
        method: "POST",
        body: JSON.stringify({
          person_titles: filters.personTitles,
          q_organization_domains: filters.organizationDomains?.join("\n"),
          person_locations: filters.locations,
          q_keywords: filters.keywords,
          page: filters.page ?? 1,
          per_page: filters.perPage ?? 25,
        }),
      });

      if (!res.ok) {
        throw new BadRequestException(
          `Apollo people search failed (${res.status}): ${await safeErrorMessage(res)}`,
        );
      }

      const body = (await res.json()) as { people?: unknown[] };
      return (body.people ?? []).map(normalizePersonPreview);
    });
  }

  async searchOrganizations(
    filters: ApolloOrganizationSearchDto,
    user: RequestUser,
  ): Promise<ApolloOrganizationPreview[]> {
    this.assertCanUse(user);

    return this.cached("organization-search", filters, async () => {
      const apiKey = await this.connection.requireApiKey();
      const res = await this.apolloFetch("/mixed_companies/search", apiKey, {
        method: "POST",
        body: JSON.stringify({
          q_organization_name: filters.name,
          organization_locations: filters.locations,
          q_keywords: filters.keywords,
          page: filters.page ?? 1,
          per_page: filters.perPage ?? 25,
        }),
      });

      if (!res.ok) {
        throw new BadRequestException(
          `Apollo organization search failed (${res.status}): ${await safeErrorMessage(res)}`,
        );
      }

      const body = (await res.json()) as { organizations?: unknown[]; accounts?: unknown[] };
      const raw = body.organizations ?? body.accounts ?? [];
      return raw.map(normalizeOrganizationPreview);
    });
  }

  // Reveals verified contact info for an existing CRM contact via Apollo's
  // People Match endpoint. Consumes an Apollo credit.
  async enrichPerson(contactId: string, user: RequestUser) {
    this.assertCanUse(user);
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: { company: { select: { name: true, domain: true } } },
    });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    const apiKey = await this.connection.requireApiKey();
    const match = await this.matchPerson(apiKey, {
      id: contact.apolloId ?? undefined,
      first_name: contact.apolloId ? undefined : contact.firstName,
      last_name: contact.apolloId ? undefined : contact.lastName,
      email: contact.email ?? undefined,
      organization_name: contact.company?.name,
      domain: contact.company?.domain ?? undefined,
    });

    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        email: match.email ?? contact.email,
        title: match.title ?? contact.title,
        linkedinUrl: match.linkedinUrl ?? contact.linkedinUrl,
        apolloId: contact.apolloId ?? match.apolloId,
        enrichedAt: new Date(),
      },
    });
  }

  // Imports selected search results by re-fetching each one's full, revealed
  // record (see module comment) and upserting it -- never trusts client-sent
  // contact fields, since the search preview the client saw was obfuscated.
  async importPeople(dto: ImportApolloPeopleDto, user: RequestUser) {
    this.assertCanUse(user);
    const apiKey = await this.connection.requireApiKey();

    const imported = [];
    for (const apolloId of dto.apolloIds) {
      const match = await this.matchPerson(apiKey, { id: apolloId });

      const companyId = match.organization
        ? (await this.upsertCompany(match.organization)).id
        : undefined;

      const contact = await this.prisma.contact.upsert({
        where: { apolloId: match.apolloId },
        create: {
          firstName: match.firstName,
          lastName: match.lastName,
          email: match.email,
          title: match.title,
          linkedinUrl: match.linkedinUrl,
          apolloId: match.apolloId,
          source: LeadSource.APOLLO,
          companyId,
        },
        update: {
          firstName: match.firstName,
          lastName: match.lastName,
          email: match.email ?? undefined,
          title: match.title ?? undefined,
          linkedinUrl: match.linkedinUrl ?? undefined,
          companyId,
        },
      });
      imported.push(contact);
    }
    return imported;
  }

  async importOrganizations(dto: ImportApolloOrganizationsDto, user: RequestUser) {
    this.assertCanUse(user);
    const apiKey = await this.connection.requireApiKey();

    const imported = [];
    for (const domain of dto.domains) {
      const detail = await this.enrichOrganization(apiKey, domain);
      imported.push(await this.upsertCompany(detail));
    }
    return imported;
  }

  private async matchPerson(
    apiKey: string,
    query: {
      id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      organization_name?: string;
      domain?: string;
    },
  ): Promise<ApolloPersonDetail> {
    return this.cached("person-match", query, async () => {
      const res = await this.apolloFetch("/people/match", apiKey, {
        method: "POST",
        body: JSON.stringify({ ...query, reveal_personal_emails: true }),
      });

      if (!res.ok) {
        throw new BadRequestException(`Apollo reveal failed (${res.status}): ${await safeErrorMessage(res)}`);
      }

      const body = (await res.json()) as { person?: unknown };
      if (!body.person) {
        throw new BadRequestException("Apollo could not find a match for this person.");
      }
      return normalizePersonDetail(body.person);
    });
  }

  private async enrichOrganization(apiKey: string, domain: string): Promise<ApolloOrganizationDetail> {
    return this.cached("organization-enrich", { domain }, async () => {
      const res = await this.apolloFetch(`/organizations/enrich?domain=${encodeURIComponent(domain)}`, apiKey);
      if (!res.ok) {
        throw new BadRequestException(
          `Apollo organization lookup failed (${res.status}): ${await safeErrorMessage(res)}`,
        );
      }
      const body = (await res.json()) as { organization?: unknown };
      if (!body.organization) {
        throw new BadRequestException(`Apollo has no organization record for "${domain}".`);
      }
      return normalizeOrganizationDetail(body.organization);
    });
  }

  // Permanent, best-effort cache for Apollo API calls -- keyed by call kind
  // plus a normalized (sorted, lowercased) hash of the request params, so
  // searching or importing the same name/domain again is served from
  // Postgres instead of spending another Apollo credit. A cache write
  // failure never fails the caller: the live Apollo result is still
  // returned, it just won't be remembered next time.
  private async cached<T>(kind: string, params: object, fetcher: () => Promise<T>): Promise<T> {
    const queryKey = cacheKey(params);
    const hit = await this.prisma.apolloCache.findUnique({
      where: { kind_queryKey: { kind, queryKey } },
    });
    if (hit) {
      return hit.payload as T;
    }

    const result = await fetcher();
    await this.prisma.apolloCache
      .upsert({
        where: { kind_queryKey: { kind, queryKey } },
        create: { kind, queryKey, payload: result as unknown as Prisma.InputJsonValue },
        update: { payload: result as unknown as Prisma.InputJsonValue },
      })
      .catch(() => {});
    return result;
  }

  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOutreach(user)) {
      throw new ForbiddenException("Sales outreach is only available to the Sales department");
    }
  }

  private upsertCompany(org: ApolloOrganizationDetail) {
    return this.prisma.company.upsert({
      where: { apolloId: org.apolloId },
      create: {
        name: org.name,
        domain: org.domain,
        industry: org.industry,
        employeeCount: org.employeeCount,
        linkedinUrl: org.linkedinUrl,
        apolloId: org.apolloId,
        source: LeadSource.APOLLO,
      },
      update: {
        name: org.name,
        domain: org.domain ?? undefined,
        industry: org.industry ?? undefined,
        employeeCount: org.employeeCount ?? undefined,
        linkedinUrl: org.linkedinUrl ?? undefined,
      },
    });
  }

  private apolloFetch(path: string, apiKey: string, init?: RequestInit) {
    return fetch(`${APOLLO_API}${path}`, {
      ...init,
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }
}

// Deterministic cache key: recursively sorts object keys, drops undefined
// entries, and lowercases/trims strings so "John" / " john " / re-ordered
// filter objects all land on the same cached entry.
function cacheKey(params: object): string {
  return JSON.stringify(normalizeForCacheKey(params));
}

function normalizeForCacheKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForCacheKey);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalizeForCacheKey(v)]),
    );
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }
  return value;
}

function normalizeOrganizationPreview(raw: unknown): ApolloOrganizationPreview {
  const o = raw as Record<string, unknown>;
  return {
    apolloId: (o.id as string) ?? null,
    name: String(o.name ?? "Unknown"),
    domain: (o.primary_domain as string) ?? (o.website_url as string) ?? null,
    industry: (o.industry as string) ?? null,
    employeeCount: typeof o.estimated_num_employees === "number" ? o.estimated_num_employees : null,
  };
}

function normalizeOrganizationDetail(raw: unknown): ApolloOrganizationDetail {
  const o = raw as Record<string, unknown>;
  return {
    apolloId: String(o.id ?? ""),
    name: String(o.name ?? "Unknown"),
    domain: (o.primary_domain as string) ?? (o.website_url as string) ?? null,
    industry: (o.industry as string) ?? null,
    employeeCount: typeof o.estimated_num_employees === "number" ? o.estimated_num_employees : null,
    linkedinUrl: (o.linkedin_url as string) ?? null,
  };
}

function normalizePersonPreview(raw: unknown): ApolloPersonPreview {
  const p = raw as Record<string, unknown>;
  const org = p.organization as Record<string, unknown> | undefined;
  return {
    apolloId: String(p.id ?? ""),
    firstName: String(p.first_name ?? ""),
    lastNamePreview: (p.last_name as string) ?? (p.last_name_obfuscated as string) ?? null,
    title: (p.title as string) ?? null,
    organizationName: (org?.name as string) ?? null,
  };
}

// Apollo returns a sentinel placeholder instead of a real address when an
// email hasn't been revealed -- treat that as "no email" rather than a fake
// address.
function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string" || !email || email.includes("email_not_unlocked")) {
    return null;
  }
  return email;
}

function normalizePersonDetail(raw: unknown): ApolloPersonDetail {
  const p = raw as Record<string, unknown>;
  const org = p.organization as Record<string, unknown> | undefined;
  return {
    apolloId: String(p.id ?? ""),
    firstName: String(p.first_name ?? ""),
    lastName: String(p.last_name ?? ""),
    title: (p.title as string) ?? null,
    email: normalizeEmail(p.email),
    linkedinUrl: (p.linkedin_url as string) ?? null,
    organization: org && org.id ? normalizeOrganizationDetail(org) : null,
  };
}

async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
