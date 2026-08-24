import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectEmail,
  disconnectEmail,
  getEmailConnectionStatus,
  getGoogleAuthorizeUrl,
  getMicrosoftAuthorizeUrl,
  getNetworkDiagnostic,
  getOAuthProviderAvailability,
  testEmailConnection,
  type ConnectEmailInput,
} from "@/lib/api/email-connections";

export function useEmailConnectionStatus() {
  return useQuery({ queryKey: ["email-connection"], queryFn: getEmailConnectionStatus });
}

export function useOAuthProviderAvailability() {
  return useQuery({ queryKey: ["email-oauth-providers"], queryFn: getOAuthProviderAvailability });
}

// Both fetch the consent-screen URL then do a full top-level navigation to
// it -- a plain fetch can't complete Google/Microsoft's own redirect chain,
// and the callback (see server/src/modules/email-oauth) expects to land the
// browser back on /account itself, not resolve a promise here.
export function useConnectGoogle() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await getGoogleAuthorizeUrl();
      window.location.href = url;
    },
  });
}

export function useConnectMicrosoft() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await getMicrosoftAuthorizeUrl();
      window.location.href = url;
    },
  });
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
