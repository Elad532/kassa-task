/**
 * ProviderKeys — resolved per-request.
 * User-supplied keys are ephemeral (React state → request header).
 * Admin-configured keys are persisted server-side (backend concern, F7).
 * Neither is ever logged.
 */
export interface ProviderKeys {
  gemini: string | null;
  openai: string | null;
}
