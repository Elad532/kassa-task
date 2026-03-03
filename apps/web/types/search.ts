/**
 * SearchFormState — the front-end search form inputs.
 * query is capped at 500 characters (enforced client-side).
 * Lives in the web app (not packages/common) because File is a browser DOM type.
 */
export interface SearchFormState {
  image: File | null;
  query: string;
}
