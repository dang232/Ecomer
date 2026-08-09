interface SearchFieldProps {
  value: string;
  onSubmit: (q: string) => void;
  placeholder?: string;
}

export function SearchField({ value, onSubmit, placeholder }: SearchFieldProps) {
  return (
    <form
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit((e.currentTarget.elements.namedItem("q") as HTMLInputElement)?.value ?? "");
      }}
    >
      <input
        type="search"
        aria-label={placeholder ?? "Search"}
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label={placeholder ?? "Search"}
        className="text-muted-foreground hover:text-foreground"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
    </form>
  );
}

interface StatusFilterProps {
  value: string;
  onChange: (status: string) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <select
      aria-label="Filter by status"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
    >
      <option value="">All</option>
      <option value="PENDING_ACCEPTANCE">Pending</option>
      <option value="ACCEPTED">Accepted</option>
      <option value="PACKED">Packed</option>
      <option value="SHIPPED">Shipped</option>
      <option value="CANCELLED">Cancelled</option>
    </select>
  );
}

interface SortMenuProps {
  options: readonly string[];
  value: string;
  onChange: (sort: string) => void;
}

export function SortMenu({ options, value, onChange }: SortMenuProps) {
  return (
    <select
      aria-label="Sort"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
