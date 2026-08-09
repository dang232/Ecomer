import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface AdminCursorPaginationOptions {
  readonly scopeKey: string;
  readonly defaultPageSize?: number;
}

export interface AdminCursorPaginationState {
  readonly cursor: string | undefined;
  readonly history: readonly (string | undefined)[];
  readonly pageSize: number;
  readonly pageIndex: number;
  readonly hasPrevious: boolean;
  readonly setPageSize: (pageSize: number) => void;
  readonly advance: (nextCursor: string | null) => void;
  readonly goBack: () => void;
  readonly reset: () => void;
}

const DEFAULT_PAGE_SIZE = 50;

export function useAdminCursorPagination({
  scopeKey,
  defaultPageSize = DEFAULT_PAGE_SIZE,
}: AdminCursorPaginationOptions): AdminCursorPaginationState {
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<readonly (string | undefined)[]>([]);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const previousScopeKey = useRef(scopeKey);
  const scopeChanged = previousScopeKey.current !== scopeKey;
  const effectiveCursor = scopeChanged ? undefined : cursor;
  const effectiveHistory = useMemo(() => (scopeChanged ? [] : history), [history, scopeChanged]);

  const reset = useCallback(() => {
    setCursor(undefined);
    setHistory([]);
  }, []);

  useEffect(() => {
    previousScopeKey.current = scopeKey;
    reset();
  }, [reset, scopeKey]);

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      if (nextPageSize === pageSize) return;
      setPageSizeState(nextPageSize);
      reset();
    },
    [pageSize, reset],
  );

  const advance = useCallback(
    (nextCursor: string | null) => {
      if (!nextCursor) return;
      setHistory((previous) => [...previous, effectiveCursor]);
      setCursor(nextCursor);
    },
    [effectiveCursor],
  );

  const goBack = useCallback(() => {
    const previousCursor = effectiveHistory.at(-1);
    if (effectiveHistory.length === 0) return;
    setHistory((previous) => previous.slice(0, -1));
    setCursor(previousCursor);
  }, [effectiveHistory]);

  return {
    cursor: effectiveCursor,
    history: effectiveHistory,
    pageSize,
    pageIndex: effectiveHistory.length,
    hasPrevious: effectiveHistory.length > 0,
    setPageSize,
    advance,
    goBack,
    reset,
  };
}
