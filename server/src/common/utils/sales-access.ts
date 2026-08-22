import { RoleName } from "@prisma/client";
import type { RequestUser } from "../types/request-user.type";

// Email outreach (Apollo search/import/enrich, templates, sequences) is a
// Sales-team tool -- every Sales department member gets access, not just
// managers, mirroring how canManageDirectory scopes HR by department name.
// Admin is always a global override.
export const SALES_OUTREACH_DEPARTMENT = "Sales";

export function canUseSalesOutreach(user: RequestUser): boolean {
  return user.role.name === RoleName.ADMIN || user.department?.name === SALES_OUTREACH_DEPARTMENT;
}
