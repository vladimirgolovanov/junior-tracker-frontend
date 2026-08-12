import { useAuthStore } from "../store/auth";

// Single HTTP client: injects the Bearer token and logs out on any 401.
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { token, logout } = useAuthStore.getState();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    logout();
  }
  return response;
}
