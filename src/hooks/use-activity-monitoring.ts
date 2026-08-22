import { useQuery } from "@tanstack/react-query";
import { getActivitySummary, type ActivitySummaryFilters } from "@/lib/api/activity-monitoring";

export function useActivitySummary(filters: ActivitySummaryFilters = {}) {
  return useQuery({
    queryKey: ["activity-summary", filters],
    queryFn: () => getActivitySummary(filters),
  });
}
