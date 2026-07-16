export interface RouteParamCodec<T> {
  parse(rawValue: string | null): T;
  serialize(value: T): string | null;
}

type RouteSchema = Record<string, RouteParamCodec<unknown>>;

export type RouteState<TSchema extends RouteSchema> = {
  [TKey in keyof TSchema]: TSchema[TKey] extends RouteParamCodec<infer TValue> ? TValue : never;
};

function asSearchParams(source: URLSearchParams | string): URLSearchParams {
  return source instanceof URLSearchParams ? source : new URLSearchParams(source);
}

export function readRouteState<TSchema extends RouteSchema>(
  source: URLSearchParams | string,
  schema: TSchema,
): RouteState<TSchema> {
  const params = asSearchParams(source);
  const state = {} as RouteState<TSchema>;

  for (const key of Object.keys(schema) as (keyof TSchema)[]) {
    state[key] = schema[key].parse(params.get(String(key))) as RouteState<TSchema>[typeof key];
  }

  return state;
}

export function writeRouteState<TSchema extends RouteSchema>(
  source: URLSearchParams | string,
  schema: TSchema,
  updates: Partial<RouteState<TSchema>>,
): URLSearchParams {
  const next = new URLSearchParams(asSearchParams(source));

  for (const key of Object.keys(updates) as (keyof TSchema)[]) {
    const codec = schema[key];
    const value = updates[key];
    if (!codec || value === undefined) continue;

    const serialized = codec.serialize(value);
    if (serialized === null) {
      next.delete(String(key));
    } else {
      next.set(String(key), serialized);
    }
  }

  return next;
}

export const routeParam = {
  string({
    defaultValue = "",
    maxLength = 200,
    trim = true,
  }: {
    defaultValue?: string;
    maxLength?: number;
    trim?: boolean;
  } = {}): RouteParamCodec<string> {
    const normalize = (value: string) => {
      const normalized = trim ? value.trim() : value;
      return normalized.slice(0, Math.max(0, maxLength));
    };
    const fallback = normalize(defaultValue);

    return {
      parse: (rawValue) => (rawValue === null ? fallback : normalize(rawValue)),
      serialize: (value) => {
        const normalized = normalize(value);
        return normalized === fallback ? null : normalized;
      },
    };
  },

  integer({
    defaultValue,
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
  }: {
    defaultValue: number;
    min?: number;
    max?: number;
  }): RouteParamCodec<number> {
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    const fallback = Math.min(upper, Math.max(lower, Math.trunc(defaultValue)));
    const normalize = (value: number) => Math.min(upper, Math.max(lower, Math.trunc(value)));

    return {
      parse: (rawValue) => {
        if (rawValue === null || rawValue.trim() === "") return fallback;
        const parsed = Number(rawValue);
        return Number.isSafeInteger(parsed) ? normalize(parsed) : fallback;
      },
      serialize: (value) => {
        const normalized = Number.isFinite(value) ? normalize(value) : fallback;
        return normalized === fallback ? null : String(normalized);
      },
    };
  },

  enum<const TValues extends readonly string[]>(
    values: TValues,
    defaultValue: TValues[number],
  ): RouteParamCodec<TValues[number]> {
    const allowed = new Set<string>(values);

    return {
      parse: (rawValue) => (rawValue !== null && allowed.has(rawValue) ? rawValue : defaultValue),
      serialize: (value) => (value === defaultValue || !allowed.has(value) ? null : value),
    };
  },

  boolean(defaultValue = false): RouteParamCodec<boolean> {
    return {
      parse: (rawValue) => {
        if (rawValue === "true" || rawValue === "1") return true;
        if (rawValue === "false" || rawValue === "0") return false;
        return defaultValue;
      },
      serialize: (value) => (value === defaultValue ? null : String(value)),
    };
  },
};
