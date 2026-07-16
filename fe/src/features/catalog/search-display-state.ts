import { resolveAsyncStatus, type AsyncStatus } from "../../shared/ui/async-state-model";

export type SearchDataSource = "search" | "catalog";
export type SearchNotice = "search-unavailable" | "index-updating" | null;

interface SearchSourceInput {
  searchEnabled: boolean;
  searchLoading: boolean;
  searchHasError: boolean;
  searchTotalElements: number;
  searchProductCount: number;
  catalogProductCount: number;
}

export interface SearchDisplayInput extends SearchSourceInput {
  catalogLoading: boolean;
  catalogHasError: boolean;
  visibleProductCount: number;
}

export interface SearchDisplayState {
  source: SearchDataSource;
  status: AsyncStatus;
  notice: SearchNotice;
}

export function resolveSearchDataSource(input: SearchSourceInput): {
  source: SearchDataSource;
  notice: SearchNotice;
} {
  if (!input.searchEnabled) {
    return { source: "catalog", notice: null };
  }

  if (input.searchHasError && input.searchProductCount > 0) {
    return { source: "search", notice: "search-unavailable" };
  }

  if (input.searchHasError) {
    return { source: "catalog", notice: "search-unavailable" };
  }

  if (!input.searchLoading && input.searchTotalElements === 0 && input.catalogProductCount > 0) {
    return { source: "catalog", notice: "index-updating" };
  }

  return { source: "search", notice: null };
}

export function resolveSearchDisplayState(input: SearchDisplayInput): SearchDisplayState {
  const sourceState = resolveSearchDataSource(input);
  const isCatalog = sourceState.source === "catalog";
  const hasData = input.visibleProductCount > 0;
  const isLoading = isCatalog ? input.catalogLoading : input.searchLoading;
  const hasError = isCatalog
    ? input.catalogHasError || (input.searchEnabled && input.searchHasError)
    : input.searchHasError;

  return {
    ...sourceState,
    status: resolveAsyncStatus({
      isLoading,
      hasError,
      hasData,
      isEmpty: !isLoading && !hasError && !hasData,
    }),
  };
}
