/**
 * apiFetch — thin fetch wrapper that injects the x-gemini-key header
 * when a user API key is present. The key is never persisted anywhere.
 */
export async function apiFetch(
  url: string,
  init: RequestInit,
  apiKey: string,
): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit);
  if (apiKey) {
    headers.set('x-gemini-key', apiKey);
  }
  return fetch(url, { ...init, headers });
}
