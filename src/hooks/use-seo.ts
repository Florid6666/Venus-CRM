import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as seoApi from "../lib/api/seo";

export function useKeywords(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: ["seo-keywords", departmentId],
    queryFn: () => seoApi.getKeywords(departmentId),
    enabled,
  });
}

export function useCreateKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createKeyword,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-keywords", variables.departmentId] });
    },
  });
}

export function useAudits(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: ["seo-audits", departmentId],
    queryFn: () => seoApi.getAudits(departmentId),
    enabled,
  });
}

export function useCreateAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createAudit,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-audits", variables.departmentId] });
    },
  });
}

export function useBacklinks(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: ["seo-backlinks", departmentId],
    queryFn: () => seoApi.getBacklinks(departmentId),
    enabled,
  });
}

export function useCreateBacklink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createBacklink,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-backlinks", variables.departmentId] });
    },
  });
}

export function useContentBriefs(departmentId?: string) {
  return useQuery({
    queryKey: ["seo-content-briefs", departmentId],
    queryFn: () => seoApi.getContentBriefs(departmentId),
    enabled: !!departmentId,
  });
}

export function useCreateContentBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createContentBrief,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs", variables.departmentId] });
    },
  });
}

export function useUpdateContentBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...brief }: Partial<seoApi.SeoContentBrief> & { id: string }) =>
      seoApi.updateContentBrief(id, brief),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs", data.departmentId] });
    },
  });
}

export function useGenerateContentBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.generateContentBrief,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seo-content-briefs", data.departmentId] });
    },
  });
}

export function useCompetitors(departmentId?: string) {
  return useQuery({
    queryKey: ["seo-competitors", departmentId],
    queryFn: () => seoApi.getCompetitors(departmentId),
    enabled: !!departmentId,
  });
}

export function useCreateCompetitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seoApi.createCompetitor,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seo-competitors", variables.departmentId] });
    },
  });
}
