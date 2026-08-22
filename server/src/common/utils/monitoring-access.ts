import { RoleName } from "@prisma/client";
import type { RequestUser } from "../types/request-user.type";

// Who can view a given user's disclosed-monitoring data (screen captures,
// login photos, and anything else in this family): Admin (everyone), HR
// (everyone -- same directory-management authority as canManageDirectory),
// or a Manager for their own department's employees only. The captured user
// themselves is deliberately NOT included -- see PROJECT_STATUS.md / the
// phase 10 plan for why this is the chosen default.
export function canViewMonitoringData(
  viewer: RequestUser,
  target: { department: { id: string } | null },
): boolean {
  const isAdmin = viewer.role.name === RoleName.ADMIN;
  const isHR = viewer.department?.name === "HR";
  const isDeptManager =
    viewer.role.name === RoleName.MANAGER && viewer.department?.id === target.department?.id;
  return isAdmin || isHR || isDeptManager;
}
