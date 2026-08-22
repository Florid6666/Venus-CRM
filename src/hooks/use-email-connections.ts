import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectEmail,
  disconnectEmail,
  getEmailConnectionStatus,
  getNetworkDiagnostic,
  testEmailConnection,
  type ConnectEmailInput,
} from "@/lib/api/email-connections";

export function useEmailConnectionStatus() {
  return useQuery({ queryKey: ["email-connection"], queryFn: getEmailConnectionStatus });
}

function useInvalidateEmailConnection() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["email-connection"] });
}

export function useConnectEmail() {
  const invalidate = useInvalidateEmailConnection();
  return useMutation({
    mutationFn: (input: ConnectEmailInput) => connectEmail(input),
    onSuccess: () => invalidate(),
  });
}

export function useTestEmailConnection() {
  const invalidate = useInvalidateEmailConnection();
  return useMutation({
    mutationFn: () => testEmailConnection(),
    onSuccess: () => invalidate(),
  });
}

export function useDisconnectEmail() {
  const invalidate = useInvalidateEmailConnection();
  return useMutation({
    mutationFn: () => disconnectEmail(),
    onSuccess: () => invalidate(),
  });
}

// A mutation (not a query) even though it's a GET -- triggered on demand by
// a "Test server network" button, not something to auto-fetch/cache on
// mount.
export function useNetworkDiagnostic() {
  return useMutation({ mutationFn: () => getNetworkDiagnostic() });
}
