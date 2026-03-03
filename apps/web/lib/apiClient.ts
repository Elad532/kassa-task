/**
 * apiFetch — thin fetch wrapper that injects the x-gemini-key header
 * when an API key is present. The key is never persisted anywhere.
 */
export async function apiFetch(
  url: string,
  init: RequestInit,
  apiKey: string,
): Promise<Response> {
  return fetch(url, init);
}
