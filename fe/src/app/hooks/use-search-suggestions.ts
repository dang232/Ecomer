import { useQuery } from "@tanstack/react-query";

import { searchSuggestions } from "@/shared/api/endpoints/search";

import { useDebouncedValue } from "./use-debounced-value";

const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;

/**
 * Debounced product-name autocomplete backed by GET /search/suggest.
 * Returns up to 10 matches, only after the input has settled for
 * {@value DEBOUNCE_MS} ms and is at least {@value MIN_QUERY_LENGTH} chars.
 */
export function useSearchSuggestions(query: string) {
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const result = useQuery({
    queryKey: ["search", "suggestions", debounced],
    queryFn: () => searchSuggestions(debounced),
    enabled,
    staleTime: 30_000,
    retry: false,
  });

  return {
    suggestions: enabled ? (result.data ?? []) : [],
    isLoading: enabled && result.isLoading,
  };
}
