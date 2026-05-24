import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  ApprovalActionInput,
  AuditEvent,
  AuditQuery,
  Flight,
  Gate,
  GateRecommendation,
  RecommendationStatus,
} from "@gtaa/contracts";

import { apiFetch } from "./api";

export const queryKeys = {
  gates: () => ["gates"] as const,
  flights: () => ["flights"] as const,
  recommendations: (status?: RecommendationStatus) =>
    ["recommendations", status ?? "all"] as const,
  audit: (filter: Partial<AuditQuery>) => ["audit", filter] as const,
};

export function useGates(): UseQueryResult<Gate[], Error> {
  return useQuery({
    queryKey: queryKeys.gates(),
    queryFn: () => apiFetch<Gate[]>("/api/gates"),
  });
}

export function useFlights(): UseQueryResult<Flight[], Error> {
  return useQuery({
    queryKey: queryKeys.flights(),
    queryFn: () => apiFetch<Flight[]>("/api/flights"),
  });
}

export function useRecommendations(
  status?: RecommendationStatus
): UseQueryResult<GateRecommendation[], Error> {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: queryKeys.recommendations(status),
    queryFn: () =>
      apiFetch<GateRecommendation[]>(`/api/gates/recommendations${qs}`),
  });
}

export interface DecideRecommendationVars {
  id: string;
  decision: ApprovalActionInput;
}

export function useDecideRecommendation(): UseMutationResult<
  GateRecommendation,
  Error,
  DecideRecommendationVars
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }) =>
      apiFetch<GateRecommendation>(
        `/api/gates/recommendations/${id}/decision`,
        { method: "POST", body: JSON.stringify(decision) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: queryKeys.gates() });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useAudit(
  filter: Partial<AuditQuery> = {}
): UseQueryResult<{ items: AuditEvent[]; nextCursor: string | null }, Error> {
  const params = new URLSearchParams();
  if (filter.resourceType) params.set("resourceType", filter.resourceType);
  if (filter.resourceId) params.set("resourceId", filter.resourceId);
  if (filter.action) params.set("action", filter.action);
  if (filter.actorId) params.set("actorId", filter.actorId);
  if (filter.since) params.set("since", filter.since);
  if (filter.until) params.set("until", filter.until);
  if (filter.limit) params.set("limit", String(filter.limit));
  const qs = params.toString();
  return useQuery({
    queryKey: queryKeys.audit(filter),
    queryFn: () =>
      apiFetch<{ items: AuditEvent[]; nextCursor: string | null }>(
        `/api/audit${qs ? `?${qs}` : ""}`
      ),
  });
}
